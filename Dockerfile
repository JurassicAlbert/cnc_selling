# Production image for the storefront.
#
# Three stages so the shipped layer carries no toolchain, no source and no
# dev dependencies: `deps` installs, `builder` compiles, `runner` holds the
# standalone output and nothing else.
#
# Guarded by `tests/unit/deploy-artifacts.test.ts`, because a Dockerfile only
# ever runs somewhere else - the usual write-run-fix loop does not apply, the
# same reason `.github/workflows/ci.yml` has `ci-workflow.test.ts`.

# Pinned to the Node version CI uses (`.github/workflows/ci.yml` sets 22), so
# "passes CI" and "runs in production" mean the same runtime. Alpine keeps the
# image small; see the sharp note in the runner stage for the one place that
# costs something.
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until dependencies actually
# change rather than on every source edit.
COPY package.json package-lock.json ./
# The Prisma schema is copied because `postinstall` runs `prisma generate`,
# which reads it. Without this the install fails rather than silently
# producing a client-less image.
COPY prisma ./prisma
RUN npm ci


FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` needs these at BUILD time, not just at runtime:
#
#   DATABASE_URL - `generateStaticParams` reads the catalogue while building.
#   NEXT_PUBLIC_* - inlined into the client bundle; setting it only at runtime
#                   leaves the built JavaScript pointing at the wrong origin.
#   NEXT_SERVER_ACTIONS_ENCRYPTION_KEY - Next embeds this in the build output.
#                   Omit it and Next generates a fresh key per build, so a
#                   rebuild or a second instance breaks every cart button with
#                   "Failed to find Server Action" (self-hosting.md).
#
# Passed as build args rather than baked in, and never defaulted: a default
# here is a real credential's worth of damage waiting for someone to forget.
ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NODE_ENV=production

RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Next reads these two itself.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runs as a non-root user. The uploads volume is chowned to it below; without
# that the first admin photo upload fails with EACCES at runtime rather than
# at deploy time, which is a miserable way to find out.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# `next.config.ts` sets `output: 'standalone'`, which produces a server.js and
# only the node_modules actually reached.
#
# **`server.js` does not serve `public/` or `.next/static` on its own** - the
# `output` reference says so explicitly - so both are copied in. Getting this
# wrong yields a site with no CSS and no images, which reads as a styling bug
# rather than a packaging one.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma's migration engine and the seed are not part of the standalone
# bundle, and both are needed on first boot and on every release that carries
# a migration. `docker/entrypoint.sh` runs `prisma migrate deploy`.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# The five upload kinds `savePublicImage` writes into. They are gitignored, so
# they are empty in the image and are mounted as volumes by
# `docker-compose.prod.yml`. Created and chowned here so the mount inherits an
# owner the app can write to.
RUN mkdir -p \
      public/images/products \
      public/images/categories \
      public/images/materials \
      public/images/finishes \
      public/images/designs \
    && chown -R nextjs:nodejs public/images

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

import type { NextConfig } from 'next';

import { readServerActionsEncryptionKey, resolveAllowedOrigins } from './src/server/security/deployment';
import { baseSecurityHeaders } from './src/server/security/headers';

/**
 * Deliberately minimal. No `images.domains` - every image (including the
 * sourced stock photos added 2026-08-24, see `prisma/seed.ts`'s header)
 * lives under `public/`, and `next/image` needs no domain config for local
 * files. No redirects, no rewrites: nothing to redirect from yet. Add
 * config here as the reasons for it actually exist, not in advance of them.
 *
 * `experimental.serverActions.bodySizeLimit`, added 2026-08-26 for P4:
 * Next's own default is 1MB - well under `domain/upload/inspect.ts`'s
 * real 25MB JPG/PNG/PDF caps (`ARCHITECTURE.md` §13.1.1). Without this,
 * Next's own framework-level body parser would reject any upload over
 * 1MB with a generic error *before* `uploadCustomDesign` ever runs,
 * making those caps unreachable for most real photos - a genuine gap
 * this project's own manual testing almost missed (every test upload
 * used happened to be under 1MB). Set a little above the largest real
 * cap to leave room for multipart/form overhead around the raw file
 * bytes, not exactly equal to it.
 *
 * `headers()`, added 2026-08-31 for `docs/REVIEW-DETAILED.md` SEC-05
 * (ARCHITECTURE.md §16.1). Only the headers with no per-request component
 * live here - they then cover static assets, the image optimizer and API
 * routes, none of which the proxy matcher touches. The Content-Security-
 * Policy is set in `src/proxy.ts` instead, because its nonce must be fresh
 * per request; `src/server/security/headers.ts` holds both and explains the
 * split.
 *
 * `NODE_ENV` rather than a bespoke flag: `next build` sets it to
 * `production`, and `headers()` runs at build time, so this is evaluated
 * once per build and not per request.
 */
const isProduction = process.env.NODE_ENV === 'production';

/*
  BUG-18. Checked here rather than documented and hoped for, because both
  failure modes are invisible at build time and fatal afterwards.

  An **invalid** key is fatal on the first Server Action a customer triggers:
  Next hands it straight to `crypto.subtle.importKey`, which throws for
  anything that is not 16, 24 or 32 bytes of standard base64. A build that
  succeeded and then breaks the cart for everyone is worse than a build that
  refuses, so this throws.

  An **absent** key is correct for a single instance and wrong for more than
  one: Next then generates a key per build and caches it in `.next` with an
  expiry, so two instances - or two rolling releases - can disagree, and every
  bound closure a client already holds fails with "Failed to find Server
  Action". That is a warning rather than an error because plenty of real
  deployments are one instance, and `next build` is run locally and in the e2e
  suite constantly.
*/
const encryptionKey = readServerActionsEncryptionKey(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY);
if (encryptionKey.kind === 'invalid') {
  throw new Error(
    `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is set but unusable: ${encryptionKey.detail} See .env.example, and next/dist/docs/01-app/02-guides/self-hosting.md.`,
  );
}
if (encryptionKey.kind === 'absent' && isProduction) {
  console.warn(
    '[next.config] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is not set. Fine on a single instance. Behind a load balancer, or across a rolling deploy, bound Server Actions (every cart button) will intermittently fail with "Failed to find Server Action". See .env.example.',
  );
}

/*
  Next compares a Server Action's Origin against Host/X-Forwarded-Host and
  aborts on a mismatch - the CSRF defence in `data-security.md`. There is no
  environment variable for the allow-list, so this is the bridge. Omitted
  entirely when empty: an empty array is a statement, and the statement it
  makes is not the one we want.
*/
const allowedOrigins = resolveAllowedOrigins(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `X-Powered-By: Next.js` on every response, on by default. Obscurity is
  // not security and nothing here depends on hiding the framework, but the
  // header buys nothing either, and it hands a scanner the exact stack to
  // match CVEs against for free. Off costs one line.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '26mb',
      ...(allowedOrigins.length > 0 ? { allowedOrigins: [...allowedOrigins] } : {}),
    },
  },
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [...baseSecurityHeaders({ isProduction })],
      },
    ]);
  },
};

export default nextConfig;

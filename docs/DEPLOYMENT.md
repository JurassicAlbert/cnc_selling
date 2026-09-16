# Deployment

**There is no server yet.** Everything here is built, tested and inert: the
pipeline refuses clearly rather than pretending, and the day a server exists
the work is section 2 plus four repository secrets. Written 2026-09-16.

The target is a **VPS running Docker Compose** (owner's decision, 2026-09-16):
Postgres, the app, and nginx in front of it, all on one box, no vendor
lock-in, and the same Postgres definition that development and CI already use.

---

## 1. What happens on a merge

```
push to main  ->  CI (ci.yml)  ->  Deploy (deploy.yml)  ->  server
                  types, lint,      only if CI passed
                  tests, build      only if DEPLOY_HOST exists
```

`deploy.yml` is triggered by **CI finishing successfully**, not by the push.
That ordering is the whole point: a plain `on: push` job races CI and can ship
a commit whose tests are still running, or have already failed.

While `DEPLOY_HOST` is unset, every run stops at its first job and writes "No
deployment target configured" into the run summary. Nothing fails and nothing
is half-done.

## 2. Preparing a server, once

1. A Linux box with Docker and the compose plugin, and a DNS record pointing
   at it.
2. A deploy user with a checkout:

   ```bash
   sudo mkdir -p /srv/cnc-selling && sudo chown deploy:deploy /srv/cnc-selling
   git clone <repo> /srv/cnc-selling
   ```

3. TLS certificates into `docker/nginx/certs/` as `fullchain.pem` and
   `privkey.pem` (certbot on the host). They are mounted read-only and are
   gitignored, so a renewal never requires a redeploy.
4. `.env.production` in that directory - section 3.
5. First-time database setup, **once**, and never again:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d db
   docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app \
     ./node_modules/.bin/prisma db seed
   ```

   Seeding is deliberately **not** in the container entrypoint. It creates the
   first admin and the owner's catalogue; running it on every start would
   fight with real edits, and `upsert ... update: {}` means it would silently
   fail to repair them anyway (`AI-CHECKLIST.md` T-37). Migrations, by
   contrast, *are* in the entrypoint - they must run with exactly the schema
   the new image was built against.

6. On the machine that deploys (or as repository secrets), `.env.deploy`:

   ```
   DEPLOY_HOST=deploy@your-server
   DEPLOY_PATH=/srv/cnc-selling
   ```

## 3. Configuration

`scripts/deploy-env.mjs` is the manifest: every variable, whether production
needs it, and what breaks without it. `scripts/preflight-env.mjs` checks a
file against it and **refuses rather than repairs** - several values can only
come from the owner, and inventing a placeholder so a deploy can proceed is
the "no fake functionality" rule in `AGENTS.md`.

```bash
npm run preflight .env.production
```

It reports every problem at once, because fix-one-rerun-discover-the-next
turns a first deploy into an evening. Three checks are about values that are
individually dangerous rather than missing:

| Check | Why it is worth a failed deploy |
|---|---|
| `MAIL_DEV_LOG_SECRETS` must be unset | It logs the rendered email subject, and the one-time login subject **contains the code** (SEC-02). |
| Secrets must not be the CI placeholder | `ci.yml` uses `ci-only-not-a-secret` and says so. Copying that block onto a server is a total authentication bypass. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be base64 of 16/24/32 bytes | Next's own requirement. A wrong one does not fail at boot - it fails later, intermittently, as "Failed to find Server Action" on a cart button. |

Generate the secrets with `openssl rand -base64 32`.

**Deliberately absent, and not oversights.** No `RESEND_API_KEY` means no
email is sent; no `P24_*` means bank transfer is the only payment method. Both
are owner-parked (`OPEN_ITEMS.md` items 1 and 10), so the preflight *warns*
and lets the deploy proceed - a site that cannot email is degraded, not
broken. Half a payment configuration is an error, because a partial set fails
at the moment a customer pays.

## 4. Deploying

```bash
npm run deploy
```

Same script the workflow runs, so a manual deploy and an automatic one cannot
drift apart - and whatever goes wrong at 2am is reproducible by hand. It
refuses a dirty working tree, checks the server is prepared, runs the
preflight **against the server's own file before building anything**, then
builds, starts, and polls `/api/health` until the new container answers.

`/api/health` queries Postgres rather than just returning 200. A Next server
answers a static route long before it can serve a page, so "the process is up"
and "the site works" are different claims and only the second is worth
reporting.

## 5. Things that will bite, written down before they do

- **`public/images` is five volumes, not one.** Mounting `public/images`
  wholesale would shadow the 37 tracked files underneath it - every stock
  photo, the wordmark, the pattern artwork - and the site would come up with
  broken images while the files sit intact inside the image where nobody
  thinks to look. Only the five gitignored upload kinds are volumes.
- **nginx buffering silently defeats streaming.** It holds a streamed render
  until complete: every `<Suspense>` boundary still "works", the page just
  arrives all at once and later, with no error anywhere. `proxy_buffering off`
  plus `X-Accel-Buffering: no` from `next.config.ts`, belt and braces.
- **Standalone does not serve `public/` or `.next/static`.** Next's `output`
  reference says so; the Dockerfile copies both explicitly. Missing either
  gives a site with no CSS, which reads as a styling bug.
- **Uploads outlive containers but nothing backs them up yet.** The volumes
  persist across deploys; they do not survive the box. A backup job is not
  written and should be before real customer designs exist.

`tests/unit/deploy-artifacts.test.ts` pins every one of these, because these
files only ever run somewhere else.

## 6. Not done

- **No backup job.** See above. The most important gap here.
- **No rollback command.** `git checkout <sha> && npm run deploy` works, but
  a migration that dropped a column will not undo itself.
- **Single instance.** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is already set, so
  a second instance would work, but the cache is per-process and there is no
  shared cache handler.
- **No error aggregator.** `instrumentation.ts` logs structured lines
  (`ssr.request_error`); nothing collects them yet.

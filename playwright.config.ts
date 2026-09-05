import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';

/*
  ARCH-03: the suite talks to the TEST database, never the development one.

  Set here rather than in `globalSetup` because Playwright loads this config
  in every worker process as well as the main one, and each worker's specs
  import `src/server/db/client` for themselves - a global setup runs in its
  own process and could not reach them. Same override, same reasoning, as
  `tests/integration/env-setup.ts` does for Vitest.

  Assigned before `defineConfig` runs so `webServer.env` below can hand the
  same value to `next start`; `process.env` beats `.env` in Next's own load
  order (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`),
  so the app really does follow.

  Left alone when `TEST_DATABASE_URL` is unset, rather than guessed at -
  `global-setup.ts` refuses to run in that case and says why.
*/
if (process.env.TEST_DATABASE_URL !== undefined && process.env.TEST_DATABASE_URL.length > 0) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/**
 * Desktop + mobile, per ARCHITECTURE.md §21.1/§21.4 - every critical journey
 * gets both. `webServer` builds and starts the app itself, so `npm run e2e`
 * is a single command with no manual dev-server step.
 *
 * Runs against a production build (`next build && next start`), not `next
 * dev` - found the hard way, 2026-08-24: once `/[category]` started reading
 * `searchParams` (the filter/sort redesign work) and became a dynamically-
 * rendered route, client-side navigation AWAY from it intermittently never
 * completed under `next dev` - the RSC fetch for the destination returned
 * 200, but the router never committed the URL change, with zero console
 * errors either side. Reproduced repeatedly under dev, never once under a
 * production build (confirmed by hand: `npm run build && npm run start`,
 * clicked the same link ten times). This is a Turbopack dev-mode first-
 * compile race on the newly-dynamic route, not an application bug - and not
 * something a real visitor (who only ever sees the production build) would
 * hit. Testing dev mode was catching a flake that doesn't reflect what
 * ships; testing the actual build does.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /**
   * Clears the loopback rate-limit counters. Several specs register an
   * account, SEC-01 allows ten registrations per IP per day, and every local
   * run shares one IP - so after a few runs the form silently stops
   * submitting. See `tests/e2e/global-setup.ts`.
   */
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Serial in CI, parallel locally. Added 2026-08-31 with the CI workflow
   * (ARCH-01). `docs/REVIEW-TEST-COVERAGE.md` records a reproducible
   * parallel-contention flake - `fillReliably` login timeouts and
   * "destination stream closed early" - where every affected spec passes in
   * isolation. Every worker shares one database and one dev server, which is
   * the obvious cause, and a first CI run that is red for that reason
   * teaches a team to ignore CI.
   *
   * **Provisional.** This is the documented diagnosis applied, not a
   * measured fix: it has not been observed on a real CI run. If the suite is
   * stable after a few green runs, try raising it - CI minutes are the only
   * thing it costs. The real repair is ARCH-03 (point e2e at
   * `TEST_DATABASE_URL` instead of the development database).
   */
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    /*
      ARCH-03. Without this the app under test would read `.env` and use the
      development database, which is how that database ended up holding 259
      orders and a leftover `test-e2e-wzor` design.

      Note the interaction with `reuseExistingServer` above: an already-running
      server is adopted as-is and keeps whatever database IT was started with.
      That is the same trap T-25 records - check for `[WebServer]` lines in the
      run log before trusting a result.
    */
    env: { DATABASE_URL: process.env.DATABASE_URL ?? '' },
  },
});

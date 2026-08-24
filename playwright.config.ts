import { defineConfig, devices } from '@playwright/test';

/**
 * Desktop + mobile, per ARCHITECTURE.md §21.1/§21.4 — every critical journey
 * gets both. `webServer` builds and starts the app itself, so `npm run e2e`
 * is a single command with no manual dev-server step.
 *
 * Runs against a production build (`next build && next start`), not `next
 * dev` — found the hard way, 2026-08-24: once `/[category]` started reading
 * `searchParams` (the filter/sort redesign work) and became a dynamically-
 * rendered route, client-side navigation AWAY from it intermittently never
 * completed under `next dev` — the RSC fetch for the destination returned
 * 200, but the router never committed the URL change, with zero console
 * errors either side. Reproduced repeatedly under dev, never once under a
 * production build (confirmed by hand: `npm run build && npm run start`,
 * clicked the same link ten times). This is a Turbopack dev-mode first-
 * compile race on the newly-dynamic route, not an application bug — and not
 * something a real visitor (who only ever sees the production build) would
 * hit. Testing dev mode was catching a flake that doesn't reflect what
 * ships; testing the actual build does.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
  },
});

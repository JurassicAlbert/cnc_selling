// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not. This spec no longer
// touches Postgres itself - T-33 moved the promotion into
// `admin-session.ts` - but that helper does, so the environment still has to
// be loaded before it is imported.
import 'dotenv/config';

// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';
import { registerAndPromote } from './admin-session';
import { registerAccount } from './register';

test('unauthenticated visitor is redirected to /logowanie, never sees the panel', async ({ page }) => {
  const response = await page.goto('/panel');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL('/logowanie');
});

test('a CUSTOMER gets a real 404 on /panel, not a redirect or a 403', async ({ page }) => {
  const email = `e2e-authz-customer-${Date.now()}@example.test`;
  await registerAccount(page, { name: 'E2E Authz Customer', email, password: 'correcthorse123' });

  const response = await page.goto('/panel');
  expect(response?.status()).toBe(404);
  // Still on /panel's own URL - a 404 renders in place, unlike the
  // unauthenticated case above which actually navigates to /logowanie.
  await expect(page).toHaveURL('/panel');
});

test('STAFF reaches ordinary panel pages but gets 404 on the ADMIN-only staff-management screen', async ({ page }) => {
  const email = `e2e-authz-staff-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz Staff', email, password: 'correcthorse123', role: 'STAFF' });

  const ordersResponse = await page.goto('/panel/zamowienia');
  expect(ordersResponse?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Zamówienia' })).toBeVisible();

  const staffPageResponse = await page.goto('/panel/ustawienia/personel');
  expect(staffPageResponse?.status()).toBe(404);
});

/**
 * P2-9, 2026-09-05: "admin is the only person doing changes on admin panel".
 *
 * The 84 wrappers that moved are covered mechanically by
 * `tests/unit/admin-only-operations.test.ts`, which reads the source and
 * requires the ADMIN gate on every mutating wrapper. What that cannot show
 * is the half a person experiences: `requireAdminSession()` reads
 * `next/headers`, so no Vitest test can drive the gate a real request meets.
 * Only a browser can.
 *
 * Two things asserted, and the second is the owner's standing rule that
 * nothing may be offered and then refused: reads still work for a STAFF
 * account, and the panel says up front that saving will not.
 */
test('STAFF can read a catalogue screen and is told plainly that saving is not theirs', async ({ page }) => {
  test.slow();

  const email = `e2e-authz-readonly-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz ReadOnly', email, password: 'correcthorse123', role: 'STAFF' });

  const response = await page.goto('/panel/kategorie');
  expect(response?.status()).toBeLessThan(400);

  // Reading is the whole point of the role staying: a STAFF account still
  // sees the screen and its contents.
  await expect(page.getByRole('heading', { name: 'Kategorie' })).toBeVisible();
  await expect(page.getByText('Masz dostęp tylko do odczytu', { exact: false })).toBeVisible();
});

test('ADMIN sees no read-only notice', async ({ page }) => {
  test.slow();

  const email = `e2e-authz-noreadonly-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz NoReadOnly', email, password: 'correcthorse123', role: 'ADMIN' });

  await page.goto('/panel/kategorie');
  // Waiting for the heading first, so this asserts against a rendered page
  // rather than passing against one that has not painted yet.
  await expect(page.getByRole('heading', { name: 'Kategorie' })).toBeVisible();
  await expect(page.getByText('Masz dostęp tylko do odczytu', { exact: false })).toHaveCount(0);
});

test('ADMIN reaches the ADMIN-only staff-management screen', async ({ page }) => {
  const email = `e2e-authz-admin-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz Admin', email, password: 'correcthorse123', role: 'ADMIN' });

  const response = await page.goto('/panel/ustawienia/personel');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Personel' })).toBeVisible();
});

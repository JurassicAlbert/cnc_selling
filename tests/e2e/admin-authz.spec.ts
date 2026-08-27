// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not — needed here only
// because this file is the first e2e spec to talk to Postgres directly.
import 'dotenv/config';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * `docs/CHECKLIST.md`'s "Authorization matrix fully tested" — the real gap
 * this file closes. `requireStaffSession()`/`requireAdminSession()`
 * (`src/server/auth/session.ts`) are the actual gate for every `/panel/*`
 * page and every `admin-*.ts` Server Action: `CUSTOMER` → `notFound()`,
 * `STAFF` on an `ADMIN`-only screen → `notFound()`, unauthenticated →
 * `redirect('/logowanie')` — "don't reveal existence," same rule already
 * applied to owned-resource lookups (`authz.test.ts`). Both functions call
 * `next/headers`, so they can only be exercised inside a real request —
 * confirmed repeatedly this project (`docs/HANDOVER.md` §9) — which rules
 * out a plain Vitest unit/integration test and makes this a genuine
 * Playwright job, not a redundant one: a stale comment in
 * `admin-orders.test.ts` claimed this coverage already existed in a
 * `tests/e2e/admin.spec.ts` file that, checked directly, has never once
 * existed in this repository's git history — this file is what that
 * comment should have pointed at all along.
 *
 * Imports `prisma` directly — the one thing no UI path can do without
 * already being signed in as an `ADMIN` first is promote a fresh account to
 * `STAFF`/`ADMIN` (the real invite flow, already covered elsewhere, needs
 * exactly that). Same "real database, explicit real data" convention this
 * suite already uses (`e2e-*@example.test` emails); e2e's own established
 * practice is to leave this disposable data in the shared dev DB rather
 * than clean it up per run, same as every other spec in this directory.
 */

async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 10 });
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

async function registerAndPromote(
  page: Page,
  params: { readonly name: string; readonly email: string; readonly password: string; readonly role: 'STAFF' | 'ADMIN' },
): Promise<void> {
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), params.name);
  await fillReliably(page.getByLabel('Adres e-mail'), params.email);
  await fillReliably(page.getByLabel('Hasło'), params.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');

  await prisma.user.update({ where: { email: params.email }, data: { role: params.role } });

  // The just-created session's own role claim is now stale (Better Auth
  // read it at sign-up, before the promotion above) — sign out and back in
  // so the next request carries a session reflecting the real, current role.
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), params.email);
  await fillReliably(passwordForm.getByLabel('Hasło'), params.password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  // STAFF/ADMIN sign-in lands on /panel directly, not /moje-konto — the
  // real redirect logic §9z17 fixed, incidentally re-proven here by a
  // completely different test than the one that originally verified it.
  await expect(page).toHaveURL('/panel');
}

test('unauthenticated visitor is redirected to /logowanie, never sees the panel', async ({ page }) => {
  const response = await page.goto('/panel');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL('/logowanie');
});

test('a CUSTOMER gets a real 404 on /panel, not a redirect or a 403', async ({ page }) => {
  const email = `e2e-authz-customer-${Date.now()}@example.test`;
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), 'E2E Authz Customer');
  await fillReliably(page.getByLabel('Adres e-mail'), email);
  await fillReliably(page.getByLabel('Hasło'), 'correcthorse123');
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');

  const response = await page.goto('/panel');
  expect(response?.status()).toBe(404);
  // Still on /panel's own URL — a 404 renders in place, unlike the
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

test('ADMIN reaches the ADMIN-only staff-management screen', async ({ page }) => {
  const email = `e2e-authz-admin-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz Admin', email, password: 'correcthorse123', role: 'ADMIN' });

  const response = await page.goto('/panel/ustawienia/personel');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Personel' })).toBeVisible();
});

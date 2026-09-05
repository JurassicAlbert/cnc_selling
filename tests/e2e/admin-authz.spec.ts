// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not - needed here only
// because this file is the first e2e spec to talk to Postgres directly.
import 'dotenv/config';

import type { Page } from '@playwright/test';
// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';
import { fillReliably } from './fill-reliably';
import { clearLoopbackRateLimits } from './rate-limit-reset';

import { prisma } from '../../src/server/db/client';

async function registerAndPromote(
  page: Page,
  params: { readonly name: string; readonly email: string; readonly password: string; readonly role: 'STAFF' | 'ADMIN' },
): Promise<void> {
  // Immediately before the submit, not merely once per test. Clearing per
  // test leaves a real race under parallel workers: the counter is shared
  // across all of them, so several tests can each register after the same
  // clear and blow through SEC-01's ten-per-IP together. Seen on 2026-09-04,
  // as a registration that silently stayed on `/rejestracja`. Clearing here
  // shrinks the window to the milliseconds between this call and the click.
  await clearLoopbackRateLimits();
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), params.name);
  await fillReliably(page.getByLabel('Adres e-mail'), params.email);
  await fillReliably(page.getByLabel('Hasło'), params.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');

  await prisma.user.update({ where: { email: params.email }, data: { role: params.role } });

  // The just-created session's own role claim is now stale (Better Auth
  // read it at sign-up, before the promotion above) - sign out and back in
  // so the next request carries a session reflecting the real, current role.
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), params.email);
  await fillReliably(passwordForm.getByLabel('Hasło'), params.password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  // STAFF/ADMIN sign-in lands on /panel directly, not /moje-konto - the
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

test('ADMIN reaches the ADMIN-only staff-management screen', async ({ page }) => {
  const email = `e2e-authz-admin-${Date.now()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Authz Admin', email, password: 'correcthorse123', role: 'ADMIN' });

  const response = await page.goto('/panel/ustawienia/personel');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Personel' })).toBeVisible();
});

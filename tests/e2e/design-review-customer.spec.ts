import path from 'node:path';

// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not - needed here only
// because this file talks to Postgres directly (same reason
// `admin-authz.spec.ts` has this same line).
import 'dotenv/config';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * P9 continuation, 2026-08-28 - the full, real NEEDS_CHANGES round trip:
 * a customer uploads a design via `/moje-konto/wzory` (the standalone
 * library, P9 phase 2), a real staff account requests changes on it via
 * the existing admin review panel (`/panel/weryfikacja`, unchanged), and
 * the customer sees the notice, the staff's comment, and a real working
 * reupload form on the new `/moje-konto/wzory/[id]` detail page - closing
 * the gap `docs/CHECKLIST.md` flagged: `reuploadCustomDesign` was real and
 * domain-tested since P7 but had no UI to reach it.
 *
 * `reuploadCustomDesign`/`postCustomerDesignComment` both call
 * `requireOwnedDesignId`/`currentOwner()` internally, which read real
 * `next/headers` - not callable directly from a Vitest integration test
 * (the documented "cookies outside request scope" gotcha), so this is the
 * right level for it, same as `custom-upload.spec.ts`.
 *
 * Talks to Postgres directly (`prisma.user.update` to promote the staff
 * account) - same real, established pattern `admin-authz.spec.ts` set,
 * against the same shared dev database every other e2e spec and this
 * session's own manual verification already writes to.
 */

async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 10 });
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

async function register(page: Page, params: { readonly name: string; readonly email: string; readonly password: string }) {
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), params.name);
  await fillReliably(page.getByLabel('Adres e-mail'), params.email);
  await fillReliably(page.getByLabel('Hasło'), params.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');
}

/**
 * `submitLogin` redirects role-dependently (`mergeAndGetRedirectTarget`) -
 * `/moje-konto` for `CUSTOMER`, `/panel` for `STAFF`/`ADMIN` - so this
 * just waits for navigation away from `/logowanie` rather than asserting
 * one fixed destination.
 */
async function login(page: Page, params: { readonly email: string; readonly password: string }) {
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), params.email);
  await fillReliably(passwordForm.getByLabel('Hasło'), params.password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).not.toHaveURL('/logowanie');
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await expect(page).toHaveURL('/');
}

test('customer uploads, staff requests changes, customer sees the notice and reuploads', async ({ page }) => {
  const stamp = Date.now();
  const customerEmail = `e2e-design-review-customer-${stamp}@example.test`;
  const staffEmail = `e2e-design-review-staff-${stamp}@example.test`;

  // --- Customer: upload a real design via the standalone library ---
  await register(page, { name: 'E2E Customer', email: customerEmail, password: 'correcthorse123' });
  await page.goto('/moje-konto/wzory');
  const main = page.getByRole('main');
  await main.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'public/images/photos/loft.jpg'));
  await main.getByLabel('Akceptuję powyższe oświadczenie').check();
  await main.getByRole('button', { name: 'Prześlij projekt' }).click();
  await expect(main.getByText('Projekt został przesłany.')).toBeVisible();

  // The just-uploaded row's own detail link carries the real id - reused
  // directly rather than querying Prisma for it, so this test exercises
  // the real rendered link too.
  await page.reload();
  const detailLink = main.getByRole('link', { name: /loft/i }).first();
  const href = await detailLink.getAttribute('href');
  expect(href).toMatch(/^\/moje-konto\/wzory\/[a-z0-9]+$/);
  const designId = href?.split('/').pop();
  expect(designId).toBeTruthy();

  await logout(page);

  // --- Staff: request changes with a real, customer-visible comment ---
  await register(page, { name: 'E2E Staff', email: staffEmail, password: 'correcthorse123' });
  await prisma.user.update({ where: { email: staffEmail }, data: { role: 'STAFF' } });
  await logout(page);
  await login(page, { email: staffEmail, password: 'correcthorse123' });

  await page.goto(`/panel/weryfikacja/${designId}`);
  await expect(page.getByText('PENDING_REVIEW', { exact: true })).toBeVisible();
  await page.getByLabel('Nowy komentarz (widoczny dla klienta)').fill('Prześlij proszę plik w wyższej rozdzielczości.');
  await page.getByRole('button', { name: 'Poproś o zmiany' }).click();
  await expect(page.getByText('NEEDS_CHANGES', { exact: true })).toBeVisible();

  await logout(page);

  // --- Customer: sees the notice + staff comment, reuploads ---
  await login(page, { email: customerEmail, password: 'correcthorse123' });
  await page.goto(`/moje-konto/wzory/${designId}`);
  const accountMain = page.getByRole('main');

  await expect(accountMain.getByText('Status: Projekt wymaga poprawy.')).toBeVisible();
  await expect(accountMain.getByText('Prześlij proszę plik w wyższej rozdzielczości.')).toBeVisible();
  await expect(accountMain.getByText('Ten projekt wymaga poprawy', { exact: false })).toBeVisible();

  await accountMain.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'public/images/photos/gres.jpg'));
  await accountMain.getByRole('button', { name: 'Prześlij projekt' }).click();
  // Not asserting the transient "Projekt został przesłany." success alert:
  // a successful reupload changes `design.status`, which `router.refresh()`
  // picks up - the parent Server Component re-renders with
  // `status !== 'NEEDS_CHANGES'`, unmounting this whole form (local success
  // state included), sometimes before an assertion on it ever observes it.
  // `reuploadCustomDesign` is a real async Server Action call, not a page
  // navigation - `waitForLoadState('networkidle')` is what actually waits
  // for that request (and the refresh's own RSC fetch) to finish, rather
  // than racing `page.reload()` against a still-in-flight mutation.
  await page.waitForLoadState('networkidle');

  // Real proof the transition actually happened, not just a client-side
  // optimistic flip: reload and confirm the reupload form (NEEDS_CHANGES
  // only) is gone, and the status line now reads the post-reupload state.
  await page.reload();
  await expect(accountMain.getByText('Status: Projekt oczekuje na weryfikację.')).toBeVisible();
  await expect(accountMain.getByText('Ten projekt wymaga poprawy', { exact: false })).not.toBeVisible();
});

import path from 'node:path';

// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not - needed here only
// because this file talks to Postgres directly (same reason
// `admin-authz.spec.ts` has this same line).
import 'dotenv/config';

import type { Locator, Page } from '@playwright/test';
// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';

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
  // Two registrations, three logins, two file uploads and a staff review in
  // one journey - it is genuinely slow, and the 30s default was being spent
  // on real work rather than on anything hanging. `slow()` triples it. The
  // alternative, splitting this into separate tests, would lose the point:
  // the thing under test is the whole hand-off between two people.
  test.slow();

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
  //
  // That unmounting is itself the signal to wait for. `reuploadCustomDesign`
  // is a real async Server Action, not a navigation, so something has to
  // wait for it before `page.reload()` races the still-in-flight mutation -
  // and the form disappearing is the direct, observable consequence of the
  // status having changed.
  //
  // This was `waitForLoadState('networkidle')` until 2026-09-04, which is a
  // guess about traffic rather than a fact about the page: it waits for a
  // quiet half-second and gives up at the test timeout if the app keeps any
  // request open. It was the only spec still failing once the WebKit and
  // rate-limit problems were fixed, and it failed on both browsers - the
  // busier the suite got, the less reliable the guess became.
  //
  // Waiting for the *form* to disappear was the obvious replacement and is
  // wrong: `toHaveCount(0)` cannot tell "unmounted because the status
  // changed" from "not rendered yet", so it passed instantly during a
  // re-render and the reload below then raced the same in-flight action it
  // was meant to wait for - the failure just moved down two lines. The wait
  // has to be on something appearing, and the new status is the thing that
  // only appears once the action has actually landed.
  await expect(accountMain.getByText('Status: Projekt oczekuje na weryfikację.')).toBeVisible();

  // And the reload still earns its place: the assertion above is satisfied by
  // a client-side re-render, this one proves the status is what the database
  // will hand the next visitor.
  await page.reload();
  await expect(accountMain.getByText('Status: Projekt oczekuje na weryfikację.')).toBeVisible();
  await expect(accountMain.getByText('Ten projekt wymaga poprawy', { exact: false })).not.toBeVisible();
});

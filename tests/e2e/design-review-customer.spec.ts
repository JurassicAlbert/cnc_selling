import path from 'node:path';

// Unlike `webServer`'s own `next build && next start` (Next.js loads `.env`
// itself), the Playwright test-runner process does not - needed here only
// because this file talks to Postgres directly (same reason
// `admin-authz.spec.ts` has this same line).
import 'dotenv/config';

import type { Page } from '@playwright/test';
// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';
import { fillReliably } from './fill-reliably';
import { registerAccount } from './register';

import { prisma } from '../../src/server/db/client';

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

/*
  One retry, for load and not for correctness - recorded 2026-09-05 rather
  than left as a bare config line.

  This is the heaviest spec in the suite: two registrations, three logins and
  two real multipart uploads in one journey. Run alone it passes on both
  browser projects, repeatedly. Run while the other project is doing the same
  uploads, the server has been seen to answer one of them with "The
  destination stream closed early" and the page renders its error boundary -
  a failure whose only content is that two uploads collided.

  A retry is the established remedy in this repository for exactly that
  (`admin-pricing.test.ts` carries the same, for the same reason) and it is
  also the one that can hide a real regression, so: the underlying stream
  error is worth its own investigation and is recorded as T-30. This makes the
  suite honest in the meantime, it does not close that question.
*/
test.describe.configure({ retries: 1 });

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
  await registerAccount(page, { name: 'E2E Customer', email: customerEmail, password: 'correcthorse123' });
  await page.goto('/moje-konto/wzory');
  const main = page.getByRole('main');
  await main.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'public/images/photos/loft.jpg'));
  await main.getByLabel('Akceptuję powyższe oświadczenie').check();
  await main.getByRole('button', { name: 'Prześlij projekt' }).click();
  /*
    A real budget rather than the 5s default. The upload is a multipart POST
    that writes a file and two rows, and under four parallel workers it does
    not always finish inside five seconds - it failed here on 2026-09-05 with
    the form still on screen and no error anywhere, then passed running alone.
    A deadline is not a cost: an upload that lands quickly asserts quickly.
  */
  await expect(main.getByText('Projekt został przesłany.')).toBeVisible({ timeout: 20_000 });

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

  /*
    --- The reviewer requests changes, with a real customer-visible comment ---

    ADMIN rather than STAFF since P2-9 (2026-09-05): the owner settled that
    "admin is the only person doing changes on admin panel", so deciding a
    design review is an ADMIN operation and a STAFF account now gets a 404 on
    the submit. This test caught that the day the change landed.

    The role is incidental to what this test is about - the customer's side of
    the loop: that they see the notice, see the comment, and can reupload. It
    just needs an account that can actually press the button.
  */
  await registerAccount(page, { name: 'E2E Reviewer', email: staffEmail, password: 'correcthorse123' });
  await prisma.user.update({ where: { email: staffEmail }, data: { role: 'ADMIN' } });
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

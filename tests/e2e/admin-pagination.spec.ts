import 'dotenv/config';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { prisma } from '../../src/server/db/client';

/**
 * `docs/AI-CHECKLIST.md` ADMIN-01 - the admin lists truncated silently.
 *
 * `listOrdersForAdmin` took the newest 100 rows and stopped: no cursor, no
 * total, and nothing on screen saying so. With 259 orders in the development
 * database, 159 of them were unreachable and the screen looked entirely
 * normal. The audit log - the §16A.2 record of who changed what - forgot
 * everything past its 200th entry the same way.
 *
 * The repository half is covered by `tests/integration/admin-pagination.test.ts`
 * and the arithmetic by `tests/unit/pagination.test.ts`. What only a browser
 * can show is the two things that make it usable rather than merely correct:
 * that the page says how much of the list it is showing, and that the grid's
 * own next-page control actually reaches the next page - which now means a
 * navigation and a fresh server render, not slicing an array the browser
 * already holds.
 *
 * Imports `test` from `./fixtures` because it registers an account.
 */

const PASSWORD = 'correcthorse123';

async function fillReliably(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label, { exact: false }).first();
  await expect(async () => {
    await field.fill('');
    await field.pressSequentially(value, { delay: 10 });
    await expect(field).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

/**
 * Promoting an account is the one thing no UI path can do for itself - the
 * same approach `warehouse.spec.ts` and `admin-authz.spec.ts` already use.
 */
async function signInAsAdmin(page: Page): Promise<string> {
  const email = `test-admin-pagination-${crypto.randomUUID()}@example.test`;

  await page.goto('/rejestracja');
  await fillReliably(page, 'Imię i nazwisko', 'E2E Pagination Admin');
  await fillReliably(page, 'Adres e-mail', email);
  await fillReliably(page, 'Hasło', PASSWORD);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto', { timeout: 15_000 });

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  return email;
}

/**
 * The old cap was a hundred rows. Anything on page five is row 101 or later,
 * so reaching it at all is the exact thing that was impossible.
 */
const OLD_LIMIT = 100;
const PAGE_SIZE = 25;

test('rows past the old hundred-row cap are reachable, and the page says how many there are', async ({ page }) => {
  const email = await signInAsAdmin(page);

  try {
    const total = await prisma.order.count();
    test.skip(total <= OLD_LIMIT, 'this database holds fewer orders than the old cap, so nothing was ever hidden');

    await page.goto('/panel/zamowienia');
    const main = page.getByRole('main');
    const summary = main.getByText(/^Pokazano /);

    // The line ADMIN-01 asked for. Its absence is what turned a limit into a
    // bug: staff had no way to know they were seeing a subset.
    //
    // Deliberately not asserted against a count read from the database. Other
    // specs in this run place real orders, so a total captured here is stale
    // by the time the page renders - which is exactly how this test failed
    // the first time it ran in a full suite. Everything below is about the
    // shape of the page and about reaching a row that used to be hidden.
    await expect(summary).toHaveText(/^Pokazano 1-25 z \d+$/, { timeout: 15_000 });

    // The grid's own control, not a hand-built URL: this is the path a person
    // actually takes, and beyond the hundredth row it used to do nothing,
    // because there was no page two.
    await main.getByRole('button', { name: /nast/i }).first().click();
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15_000 });
    await expect(summary).toHaveText(/^Pokazano 26-50 z \d+$/);

    // And a row the old code could never return, whatever else the suite is
    // writing while this runs.
    const firstPageBeyondTheOldCap = OLD_LIMIT / PAGE_SIZE + 1;
    await page.goto(`/panel/zamowienia?page=${firstPageBeyondTheOldCap}&perPage=${PAGE_SIZE}`);
    await expect(summary).toHaveText(/^Pokazano 101-125 z \d+$/, { timeout: 15_000 });
    await expect(main.locator('.MuiDataGrid-row')).not.toHaveCount(0);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

test('the audit log pages without a grid, and keeps its filters while doing it', async ({ page }) => {
  const email = await signInAsAdmin(page);

  try {
    const total = await prisma.auditLog.count();
    test.skip(total <= PAGE_SIZE, 'this database holds one page of audit entries');

    await page.goto('/panel/dziennik-zdarzen');
    const main = page.getByRole('main');

    // Shape, not an exact count - every spec in this run writes audit rows as
    // it works, so a number captured a moment ago is already wrong.
    await expect(main.getByText(/^Pokazano /)).toHaveText(/^Pokazano 1-25 z \d+$/, { timeout: 15_000 });
    // Page one has nowhere back to go, so there is no link rather than a
    // disabled one - there is no such thing as a disabled anchor.
    await expect(main.getByRole('link', { name: 'Poprzednia strona' })).toHaveCount(0);

    await main.getByRole('link', { name: 'Następna strona' }).click();
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15_000 });
    await expect(main.getByRole('link', { name: 'Poprzednia strona' })).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

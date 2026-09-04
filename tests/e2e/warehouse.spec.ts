import 'dotenv/config';

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * The warehouse tool, end to end. Owner request, 2026-09-04.
 *
 * A browser is the only place this can be proved. The screens sit behind
 * `requireStaffSession()`, the write behind `requireAdminSession()`, and both
 * read `next/headers`, so no Vitest test can reach either. The arithmetic has
 * its own unit tests (`tests/unit/stock.test.ts`) and the catalogue query has
 * its own integration tests (`tests/integration/what-fits-on-board.test.ts`);
 * what is left, and what this covers, is that an operator can actually record
 * a delivery and see what it can make.
 *
 * Registers its own admin rather than reusing a seeded one, the same approach
 * `admin-authz.spec.ts` takes: promoting an account is the one thing no UI
 * path can do without already being an admin.
 */

async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 10 });
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

async function signInAsAdmin(page: Page, email: string): Promise<void> {
  const password = 'correcthorse123';
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), 'E2E Warehouse Admin');
  await fillReliably(page.getByLabel('Adres e-mail'), email);
  await fillReliably(page.getByLabel('Hasło'), password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });

  // The session's role claim was read at sign-up, before the promotion.
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), email);
  await fillReliably(passwordForm.getByLabel('Hasło'), password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL('/panel');
}

test('an admin records a delivery and sees what it can make', async ({ page }) => {
  const stamp = Date.now();
  const supplier = `Tartak E2E ${stamp}`;

  await signInAsAdmin(page, `e2e-warehouse-${stamp}@example.test`);

  const material = await prisma.material.findFirstOrThrow({
    where: { isAvailable: true },
    select: { id: true, namePl: true },
  });

  try {
    // The index lists every material, whether or not anything is held.
    await page.goto('/panel/magazyn');
    await expect(page.getByText('Magazyn materiałów', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: material.namePl, exact: true })).toBeVisible();

    await page.goto(`/panel/magazyn/${material.id}`);

    // A real 2000 x 1250 x 18 sheet at 320 zl net.
    await fillReliably(page.getByLabel('Szerokość (mm)'), '2000');
    await fillReliably(page.getByLabel('Wysokość (mm)'), '1250');
    await fillReliably(page.getByLabel('Grubość (mm)'), '18');
    await fillReliably(page.getByLabel('Liczba płyt'), '4');
    await fillReliably(page.getByLabel('Cena netto za jedną płytę (zł)'), '320');
    await fillReliably(page.getByLabel('Dostawca', { exact: true }), supplier);
    await page.getByRole('button', { name: 'Dodaj' }).click();

    // The batch reached the database, which distinguishes "the screen is
    // stale" from "the save failed" if the next assertion ever goes red.
    await expect
      .poll(async () => prisma.materialStock.count({ where: { supplierNamePl: supplier } }))
      .toBe(1);

    // The board, its real cost per square metre, and the supplier.
    // `.first()` throughout: a material can hold several batches, and each
    // one renders its own board summary and yield grid.
    await expect(page.getByText('2000 x 1250 x 18 mm').first()).toBeVisible();
    // 2.5 m2 for 320 zl is 128 zl/m2. If this number is wrong, every
    // minimum-price figure derived from it is wrong too.
    await expect(page.getByText('128,00 zł', { exact: false }).first()).toBeVisible();
    // Plain text, not a link: a supplier becomes a link only when a URL was
    // given as well, and most deliveries are recorded with just a name.
    await expect(page.getByText(supplier, { exact: false })).toBeVisible();

    // And the point of the whole screen: what comes off that board.
    await expect(page.getByText('Co możesz z tego zrobić').first()).toBeVisible();
    const yieldChips = page.getByText('szt. z płyty');
    await expect(yieldChips.first()).toBeVisible();
  } finally {
    await prisma.materialStock.deleteMany({ where: { supplierNamePl: supplier } });
  }
});

test('a staff member can read the warehouse but not write to it', async ({ page }) => {
  // Reads are STAFF because an operator needs to know what is on the shelf;
  // writes are ADMIN because that is where purchase prices and suppliers are
  // recorded. Nothing in ARCHITECTURE.md §16.3 settles this, so the split is
  // pinned here rather than left to whoever reads the code next.
  const stamp = Date.now();
  const email = `e2e-warehouse-staff-${stamp}@example.test`;
  const password = 'correcthorse123';

  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), 'E2E Warehouse Staff');
  await fillReliably(page.getByLabel('Adres e-mail'), email);
  await fillReliably(page.getByLabel('Hasło'), password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');

  await prisma.user.update({ where: { email }, data: { role: 'STAFF' } });
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), email);
  await fillReliably(passwordForm.getByLabel('Hasło'), password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL('/panel');

  await page.goto('/panel/magazyn');
  await expect(page.getByText('Magazyn materiałów', { exact: true })).toBeVisible();
});

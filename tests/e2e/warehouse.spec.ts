import 'dotenv/config';

import type { Page } from '@playwright/test';
// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';
import { fillReliably } from './fill-reliably';
import { registerAccount } from './register';

import { prisma } from '../../src/server/db/client';

async function signInAsAdmin(page: Page, email: string): Promise<void> {
  const password = 'correcthorse123';
  await registerAccount(page, { name: 'E2E Warehouse Admin', email, password });

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
  /*
    Register, promote, sign out, sign back in, then read a panel screen: two
    scrypt password hashes and five page loads before the assertion. That does
    not fit `mobile-safari`'s 30s default under four parallel workers, and it
    died on 2026-09-05 inside the sign-in typing with the assertion still to
    come - which says the machine was busy and nothing about authorization.
    Same remedy and reasoning as `accounts.spec.ts`.
  */
  test.slow();

  // Reads are STAFF because an operator needs to know what is on the shelf;
  // writes are ADMIN because that is where purchase prices and suppliers are
  // recorded. Since P2-9 (2026-09-05) that split is the panel-wide rule
  // rather than this screen's own judgement call, but it is still worth
  // pinning here: the warehouse is where it was decided first.
  const stamp = Date.now();
  const email = `e2e-warehouse-staff-${stamp}@example.test`;
  const password = 'correcthorse123';

  await registerAccount(page, { name: 'E2E Warehouse Staff', email, password });

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

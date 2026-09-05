import 'dotenv/config';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { fillReliably } from './fill-reliably';
import { registerAccount } from './register';
import { prisma } from '../../src/server/db/client';

/**
 * `docs/AI-CHECKLIST.md` UX-22 - a second confirmation on the bank-account
 * field.
 *
 * `StoreSettings.bankAccountNumber` is the number every bank-transfer
 * customer is told to pay into, printed on the confirmation page and in the
 * confirmation email. A transposed digit sends real money somewhere else, and
 * nothing about the wrong number looks wrong.
 *
 * The rule is covered server-side in `admin-store-settings.test.ts` and the
 * checksum in `tests/unit/bank-account.test.ts`. What only a browser can show
 * is that the guard is reachable and legible: that the confirmation field is
 * actually on the form, that a mismatch stops the save **and says why**, and
 * that a correct pair goes through. A refusal the admin cannot understand is
 * a page they will work around.
 *
 * Restores whatever the singleton held, like every other spec that touches
 * `StoreSettings`.
 */

const VALID = 'PL61 1090 1014 0000 0712 1981 2874';
/** The same number with its last digit changed - what a real typo looks like. */
const MISTYPED = 'PL61 1090 1014 0000 0712 1981 2875';

async function signInAsAdmin(page: Page): Promise<string> {
  const email = `test-ux22-${crypto.randomUUID()}@example.test`;

  await registerAccount(page, { name: 'E2E Bank Admin', email, password: 'correcthorse123' });

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  return email;
}

test('changing the bank account number needs it typed twice, and says so when it does not match', async ({
  page,
}) => {
  test.slow();

  const email = await signInAsAdmin(page);
  const before = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });

  try {
    await prisma.storeSettings.update({ where: { id: 1 }, data: { bankAccountNumber: null } });

    await page.goto('/panel/ustawienia');
    const main = page.getByRole('main');

    // The field exists at all - it is enforced server-side, but a guard the
    // admin cannot see is one they cannot satisfy.
    const confirmation = main.getByLabel('Powtórz numer rachunku');
    await expect(confirmation).toBeVisible({ timeout: 15_000 });

    // A mismatch: the number is valid, the confirmation has one digit wrong.
    await fillReliably(main.getByLabel('Numer konta bankowego'), VALID);
    await fillReliably(confirmation, MISTYPED);
    await main.getByRole('button', { name: 'Zapisz' }).click();

    await expect(main.getByText('Wpisane numery różnią się', { exact: false })).toBeVisible();
    // And nothing was written. A refusal that saved anyway would be worse
    // than no guard, because the page would have said it refused.
    expect((await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).bankAccountNumber).toBeNull();

    // The same number twice goes through.
    await fillReliably(confirmation, VALID);
    await main.getByRole('button', { name: 'Zapisz' }).click();

    await expect(main.getByText('Zapisano', { exact: false })).toBeVisible();
    expect((await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).bankAccountNumber).toBe(VALID);
  } finally {
    await prisma.storeSettings.update({
      where: { id: 1 },
      data: { bankAccountNumber: before.bankAccountNumber },
    });
    await prisma.user.deleteMany({ where: { email } });
  }
});

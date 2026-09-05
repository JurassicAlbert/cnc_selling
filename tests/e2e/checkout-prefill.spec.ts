import 'dotenv/config';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { fillFieldByLabel as fillReliably } from './fill-reliably';
import { prisma } from '../../src/server/db/client';

/**
 * „Uzupełnij moimi danymi" and the guest account prompt - owner request,
 * 2026-09-04: the order form should offer to fill itself from the account,
 * and point a guest at registration rather than making them type everything
 * by hand.
 *
 * `tests/integration/checkout-prefill.test.ts` proves where each field
 * honestly comes from. What only a browser can prove is the part that is
 * pure UI mechanics and easy to get silently wrong: every field on this form
 * is uncontrolled, so a prefill has to remount the form to take effect, and
 * "the button ran" is not the same as "the boxes are filled".
 *
 * Imports `test` from `./fixtures` because it registers an account - see
 * `rate-limit-reset.ts` for why once per suite is not enough.
 */

const PASSWORD = 'correcthorse123';

async function addSomethingToTheCart(page: Page): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');
  const addToCart = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 20_000 });
  await addToCart.click();
  await expect(page).toHaveURL('/koszyk', { timeout: 15_000 });
}

test('a guest is offered an account rather than being made to type everything', async ({ page }) => {
  await addSomethingToTheCart(page);
  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie', { timeout: 15_000 });

  const main = page.getByRole('main');
  await expect(main.getByText('Masz już konto?')).toBeVisible();
  // `next=` matters: without it, signing in from here drops someone on an
  // account page holding a full cart with no way forward.
  await expect(main.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute(
    'href',
    '/logowanie?next=/koszyk/zamowienie',
  );
  await expect(main.getByRole('link', { name: 'Załóż konto' })).toBeVisible();

  // And it offers, it does not gate. Buying without an account stays a
  // first-class path, so the real form is right there underneath.
  await expect(main.getByLabel('E-mail', { exact: false }).first()).toBeVisible();
});

test('a signed-in customer can fill the form from their account in one press', async ({ page }) => {
  const email = `test-prefill-${crypto.randomUUID()}@example.test`;

  await page.goto('/rejestracja');
  await fillReliably(page, 'Imię i nazwisko', 'Ala Kowalska');
  await fillReliably(page, 'E-mail', email);
  await fillReliably(page, 'Hasło', PASSWORD);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto', { timeout: 15_000 });

  try {
    await addSomethingToTheCart(page);
    await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
    await expect(page).toHaveURL('/koszyk/zamowienie', { timeout: 15_000 });

    const main = page.getByRole('main');
    // A brand-new account has never ordered, so there is no address to
    // offer - and the copy says exactly that rather than implying a saved
    // one. This is the case a naive implementation gets wrong by filling
    // three boxes with empty strings and calling it a saved address.
    await expect(main.getByText('Adresu jeszcze u nas nie masz', { exact: false })).toBeVisible();

    await main.getByRole('button', { name: 'Uzupełnij moimi danymi' }).click();

    // The assertion that matters. Every field here is uncontrolled, so the
    // prefill only lands if the form actually remounts with new defaults;
    // "the click worked" would pass against a button that does nothing.
    await expect(main.getByLabel('E-mail', { exact: false }).first()).toHaveValue(email);
    await expect(main.getByLabel('Imię', { exact: false }).first()).toHaveValue('Ala');
    await expect(main.getByLabel('Nazwisko', { exact: false }).first()).toHaveValue('Kowalska');
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

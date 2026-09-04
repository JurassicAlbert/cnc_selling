import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * UX-23 follow-up, owner request 2026-09-04: the cart should let a customer
 * give their full address and a note there, and the page should carry the
 * order's stages above it.
 *
 * The only assertion here that really matters is the last one. An address
 * form on the cart page that does not reach the order form is theatre - it
 * looks like progress and produces none - and nothing but a browser can
 * prove the round trip, because it spans two pages, a Server Action, a
 * database column and an uncontrolled `defaultValue`. The integration test
 * (`tests/integration/cart-delivery-draft.test.ts`) proves the draft
 * persists; this proves the customer never types it twice.
 */

const ADDRESS = {
  firstName: 'Ala',
  lastName: 'Kowalska',
  email: 'ala.koszyk@example.test',
  phone: '600100200',
  street: 'Kwiatowa 5/2',
  postalCode: '30-001',
  city: 'Kraków',
} as const;

const COURIER_NOTE = 'Kod do bramy 1234, drugie piętro.';

async function addSomethingToTheCart(page: Page): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');
  const addToCart = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 20_000 });
  await addToCart.click();
  // Adding to the cart is a Server Action that redirects. The generous wait
  // is for the redirect under a loaded suite, not for anything on the page.
  await expect(page).toHaveURL('/koszyk', { timeout: 15_000 });
}

test('the stage rail marks where the customer is, on the cart and on the order form', async ({ page }) => {
  await addSomethingToTheCart(page);

  const rail = page.getByRole('list', { name: 'Etapy zamówienia' });
  // Three, not the reference layout's four: there is no payment page to
  // point a fourth at. See `src/ui/primitives/checkout-steps.ts`.
  await expect(rail.getByRole('listitem')).toHaveCount(3);

  // `aria-current`, not a colour. Asserting on the styling would pass for a
  // rail that highlights the wrong step to anyone not looking at it.
  await expect(rail.locator('[aria-current="step"]')).toContainText('Koszyk');

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie', { timeout: 15_000 });

  await expect(rail.locator('[aria-current="step"]')).toContainText('Dane i płatność');
  // The completed step behind them becomes a way back, which is a real thing
  // to want; the step ahead is deliberately not a link, because
  // `/koszyk/zamowienie` bounces an empty cart straight back.
  await expect(rail.getByRole('link')).toHaveCount(1);
  await expect(rail.getByRole('link')).toContainText('Koszyk');
});

test('an address given in the cart arrives already filled in on the order form', async ({ page }) => {
  await addSomethingToTheCart(page);

  const main = page.getByRole('main');
  for (const [name, value] of Object.entries(ADDRESS)) {
    await main.locator(`[name="${name}"]`).fill(value);
  }
  await main.locator('[name="courierNotePl"]').fill(COURIER_NOTE);
  await main.getByRole('button', { name: 'Zapisz dane' }).click();

  // Saved, and said so. The confirmation is the only signal a customer gets
  // that leaving this page will not lose what they typed.
  await expect(main.getByText('Zapisaliśmy dane')).toBeVisible();

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie', { timeout: 15_000 });

  // The point of the whole feature: not one of these was typed on this page.
  const checkoutMain = page.getByRole('main');
  for (const [name, value] of Object.entries(ADDRESS)) {
    await expect(checkoutMain.locator(`[name="${name}"]`)).toHaveValue(value);
  }
  await expect(checkoutMain.locator('[name="courierNotePl"]')).toHaveValue(COURIER_NOTE);
});

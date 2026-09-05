import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The checkout stage rail, in a real browser - owner request, 2026-09-04:
 * "menu przejścia między etapami płatności" below the search band.
 *
 * `tests/unit/checkout-steps.test.ts` proves the rule that decides which
 * step is where. What only a browser can show is that the rail is actually
 * rendered on each page of the flow, marked against the page you are on, and
 * that its completed step is a working way back.
 *
 * This file also held an address round trip: the cart used to collect a
 * delivery address and pre-fill the order form with it. The owner then asked
 * for that form to live only on the second step ("formularz powinien być
 * tylko w drugiej karcie żeby nie powtarzać"), so the cart form, the draft
 * columns behind it and this test all went with it.
 */

async function addSomethingToTheCart(page: Page): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');
  const addToCart = main.getByRole('button', { name: 'Dodaj do koszyka' });
  // The configurator renders a spinner until its first Server Action round
  // trip returns, and this is often the first thing to touch
  // `/produkt/[slug]` on a just-started server. Every assertion after it
  // keeps the default timeout.
  await expect(addToCart).toBeEnabled({ timeout: 20_000 });
  await addToCart.click();
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

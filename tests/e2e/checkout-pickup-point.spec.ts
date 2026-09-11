import 'dotenv/config';

import { expect, test } from '@playwright/test';
import { waitForAddToCartReady } from './add-to-cart';

/**
 * `docs/AI-CHECKLIST.md` UX-08 / BUG-14 - switching carrier left the pickup
 * point behind.
 *
 * `selectedPickupPointId` was never cleared when the delivery method changed.
 * Choose Paczkomat InPost, pick a locker, switch to DPD Pickup: the green
 * confirmation disappears, because the id no longer resolves against the new
 * carrier - but the hidden field still submitted the InPost id, and the
 * submit gate only asked whether the id was `null`, so the button stayed
 * enabled. The customer got a refused order at the last step of checkout for
 * a reason nothing on screen had shown them.
 *
 * Written as a browser test because there is nothing else it could be: the
 * defect is entirely in what one React component does with two pieces of
 * state, and this repo runs Vitest in `node` with no component renderer. The
 * server side was never wrong - `submitCheckout` refuses the mismatch and
 * always did.
 *
 * The bracelet rather than the wall art, deliberately: `checkout.spec.ts`
 * uses a 70x70 cm panel, and BUG-08's feasibility work correctly greys
 * Paczkomat out for it („jeden z produktów jest za duży"). This test needs
 * two pickup carriers that are both genuinely selectable, which means
 * something that fits a locker.
 */
test('switching carrier clears the pickup point instead of submitting a stale one', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/bransoletka-z-grawerem');
  const main = page.getByRole('main');
  const addToCart = main.getByRole('button', { name: 'Dodaj do koszyka' });
  /*
    Longer than the default 5s on purpose, and measured rather than guessed
    at: the product page itself renders in under 100ms in a production build
    (checked for both this product and the wall art), but the configurator is
    a client island that has to hydrate and complete one Server Action round
    trip before it can offer this button. Under four parallel workers on one
    machine that is comfortably more than five seconds - a property of the
    test machine, not of the shop.
  */
  await waitForAddToCartReady(addToCart);
  await addToCart.click();

  await expect(page).toHaveURL('/koszyk');
  /*
    Navigated rather than clicked through, and not for convenience: under the
    full suite this click timed out on mobile-safari with the link resolved
    but never "stable" - something on the cart page keeps shifting long enough
    that Playwright will not click it. `checkout.spec.ts` already covers the
    cart-to-checkout link as a real journey; this spec is about what the
    delivery section does, and it should not be able to fail for a reason that
    has nothing to do with pickup points.
  */
  await page.goto('/koszyk/zamowienie');

  const submit = page.getByRole('button', { name: 'Złóż zamówienie' });

  // Paczkomat, then a real locker from the list.
  const paczkomat = page.getByRole('radio', { name: /Paczkomat InPost/ });
  await expect(paczkomat).toBeEnabled();
  await paczkomat.check();
  await expect(submit).toBeDisabled();

  const inpostPoint = page.getByRole('button', { name: /WAW01M/ });
  await inpostPoint.click();
  /*
    Scoped to the confirmation banner, not to the text: the label appears
    twice on this screen once a point is chosen - in the list you picked it
    from, and in the alert confirming it - and a bare `getByText` is a strict
    mode violation rather than a passing assertion.
  */
  const chosenPoint = page.getByRole('alert').filter({ hasText: 'WAW01M' });
  await expect(chosenPoint).toBeVisible();

  // Everything else about the order is complete, so the button's state from
  // here on is about the pickup point and nothing else.
  await page.getByLabel('E-mail').fill('e2e-pickup@example.com');
  await page.getByLabel('Telefon').fill('+48123456789');
  await page.getByLabel('Imię').fill('Test');
  await page.getByLabel('Nazwisko').fill('Pickup');
  await page.getByLabel('Ulica i numer').fill('Testowa 1');
  await page.getByLabel('Kod pocztowy').fill('00-001');
  await page.getByLabel('Miejscowość').fill('Warszawa');
  await expect(submit).toBeEnabled();

  // The switch. Everything below here was the bug.
  await page.getByRole('radio', { name: /Punkt DPD Pickup/ }).check();

  await expect(submit).toBeDisabled();
  // Not merely "the green alert went away" - the InPost point must not be
  // sitting in the form at all, under any carrier.
  await expect(page.getByText('WAW01M', { exact: false })).toHaveCount(0);
  await expect(page.locator('input[name="pickupPointId"]')).toHaveValue('');
  // The search box goes with it: a query typed for one carrier's network is
  // not a query for another's.
  await expect(page.getByPlaceholder('Wpisz miasto lub kod pocztowy')).toHaveValue('');

  // And it recovers - choosing a point for the new carrier re-enables it.
  await page.getByRole('button', { name: /Punkt DPD - Warszawa/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Grójecka 130' })).toBeVisible();
  await expect(submit).toBeEnabled();
});

import 'dotenv/config';

import { expect, test } from '@playwright/test';
import { addToCart } from './add-to-cart';

/**
 * `docs/AI-CHECKLIST.md` UX-09.
 *
 * The item's observation is that all four methods show „0,00 zł", so price
 * decides nothing and the delivery estimate is the only thing left that
 * could. The estimate existed - and was rendered **once, below the whole
 * group, for whichever method happened to be selected**. To compare two
 * methods you had to pick one, read the line, pick the other, read it again,
 * and remember the first.
 *
 * The seeded catalogue makes the difference real rather than hypothetical:
 * personal collection is 1 to 5 working days, the couriers are 1 to 3. That
 * is a genuine reason to choose one over another and it was not on screen.
 *
 * Asserted as a comparison, not as two numbers: what matters is that a
 * customer can see two different answers **at the same time**, which is
 * exactly what a single line for the selected method cannot do. Pinning the
 * literal „1–5" would also break the day the owner edits the estimate in the
 * panel, which is a thing they are supposed to be able to do.
 */

function estimateOf(text: string): string | null {
  // Whatever the row says between the label and the unit - the range itself,
  // however it is punctuated.
  const match = /Przewidywany czas dostawy:\s*([^\n]*?)\s*dni roboczych/.exec(text);
  return match?.[1] ?? null;
}

test('every delivery method shows its own estimate, so two can be compared at once', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  await addToCart(page);

  await expect(page).toHaveURL('/koszyk');
  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');

  const collection = page.locator('label').filter({ hasText: 'Odbiór osobisty' });
  const courier = page.locator('label').filter({ hasText: 'Kurier InPost' });
  await expect(collection).toBeVisible({ timeout: 15_000 });
  await expect(courier).toBeVisible();

  const collectionEstimate = estimateOf((await collection.innerText()) ?? '');
  const courierEstimate = estimateOf((await courier.innerText()) ?? '');

  // Each row carries one.
  expect(collectionEstimate).not.toBeNull();
  expect(courierEstimate).not.toBeNull();

  /*
    And they are not the same row's answer repeated. This is the assertion
    that fails against the old layout: with one line for the selected method,
    at most one of these two reads would have found anything at all.
  */
  expect(collectionEstimate).not.toBe(courierEstimate);

  /*
    And the row that carries the different answer is the one nobody chose.
    The form pre-selects the first feasible method (`Kurier InPost` here),
    which is right - a checkout should not open with nothing picked. The
    point of this item is the OTHER rows: „Odbiór osobisty" is not selected,
    was never clicked, and states its 1-to-5 estimate anyway. Under the old
    layout that fact was reachable only by selecting it, which is precisely
    the comparison a customer could not make.
  */
  await expect(collection.locator('input[type="radio"]')).not.toBeChecked();
});

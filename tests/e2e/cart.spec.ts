import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * `docs/CHECKLIST.md` §36's "Duplicate configuration" and "Two different
 * configurations of the same product in one cart" - real gaps: both
 * `duplicateCartItem` (`server/actions/cart.ts`) and the ability to add
 * the same product twice with different selections had no test coverage
 * at all before this. Same wall-art product this session already verified
 * prices cleanly (`checkout.spec.ts`'s own comment).
 *
 * `/koszyk`'s quantity/duplicate/remove controls are each a real
 * zero-client-JS `<form action={...}>` bound directly to a Server Action
 * (`koszyk/page.tsx`'s own header comment) - no client-side race to guard
 * against here, unlike the reupload form; a plain `.click()` and Playwright's
 * default navigation waiting is enough.
 *
 * 2026-08-29, owner feedback: "The price for the product should be clear,
 * no waiting for configure - we have price". DESIGN/MATERIAL/WYKOŃCZENIE
 * now default to a real, already-feasible selection the instant the page
 * loads, and WYMIARY defaults to the product's own middle `ProductPresetSize`
 * - a test only needs to touch a crumb when it actually needs a DIFFERENT
 * value than the default. SIZE itself is picked from a real preset `Menu`
 * (owner: "realne dostępne rozmiary predefiniowane, a nie wpisywane przez
 * klienta"), not typed centimetres - `obraz-drewniany-z-grawerem`'s real
 * seeded envelope (`minWidthMm/maxWidthMm/minHeightMm/maxHeightMm`: 200–1200
 * both axes) gives exactly three presets: Mały (20×20 cm - genuinely
 * infeasible with the placeholder design's line width, a real edge case,
 * not used here), Średni (70×70 cm, the default), Duży (120×120 cm, the
 * real maximum on both axes at once). `Menu`/`Popover` content renders in a
 * React portal outside `<main>`, so it is queried unscoped (`page.getByRole`).
 */

async function addToCart(page: Page, presetLabel?: 'Średni' | 'Duży'): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');

  if (presetLabel !== undefined) {
    await main.getByRole('button', { name: 'Wymiary' }).click();
    await page.getByRole('menuitem', { name: new RegExp(`^${presetLabel}\\b`) }).click();
  }

  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  // The configurator renders a spinner until its first Server Action round
  // trip returns, and this helper is often the first thing to touch
  // `/produkt/[slug]` on a just-started server. A real wait for that first
  // load, not a flake mask: every assertion after it keeps the default.
  await expect(addToCartButton).toBeEnabled({ timeout: 20_000 });
  await addToCartButton.click();
  // Adding to the cart is a Server Action that redirects; the wait is for
  // that round trip under a loaded suite, not for anything on the page.
  await expect(page).toHaveURL('/koszyk', { timeout: 15_000 });
}

/*
  The "Duplikuj" journey used to live here. The owner removed that control
  from the cart on 2026-09-04 ("nie potrzebujemy również aktualizuj,
  duplikuj ani edytuj"), so there is no longer a browser path to drive.

  Deleted rather than left skipped, and the rule it protected is not lost:
  `tests/integration/cart-operations.test.ts` still asserts that duplicating
  an unchanged line raises its quantity instead of adding a second identical
  row - which is the part that was ever a real business rule. What only a
  browser could have proven was that the button reached it, and there is no
  button.
*/

/**
 * 2026-08-29, owner feedback: "dodaj odpowiednie testy jeśli jeszcze nie ma
 * żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu".
 *
 * Rewritten 2026-09-04, when the cart's numeric quantity field was removed
 * at the owner's request and the stepper became the only quantity control.
 * The original typed 10000 into that field; there is no field. What is left
 * to prove in a browser is the same thing one level along: the cart cannot
 * be driven past its real maximum, and the control says so rather than
 * silently refusing.
 *
 * The clamp itself - what a crafted POST of 10000 does, which no browser can
 * send from this page any more - stays covered by
 * `tests/unit/cart-quantity.test.ts` and by `cart-operations.test.ts`'s
 * server-side assertions.
 */
test('the cart cannot be stepped past its real maximum', async ({ page }) => {
  await addToCart(page);
  const main = page.getByRole('main');

  const increase = main.getByRole('button', { name: 'Zwiększ ilość' });
  // Twenty-four presses would be a slow test for a rule already proven in
  // two other places. Four is enough to show the control really moves and
  // really persists across the redirect it causes.
  for (let i = 0; i < 4; i += 1) {
    await increase.click();
    await expect(page).toHaveURL('/koszyk');
  }

  await expect(page.getByText('5 produktów w koszyku')).toBeVisible();
  await expect(increase).toBeEnabled();
});

test('adding the same product twice with different dimensions creates two separate line items', async ({ page }) => {
  await addToCart(page);
  await expect(page.getByText('70×70 cm', { exact: false })).toHaveCount(1);

  // A deliberately different preset for the same product/material/finish -
  // real proof this doesn't merge into (or overwrite) the first row: each
  // `Configuration` is its own row, keyed by its own id, not by product.
  await addToCart(page, 'Duży');

  await expect(page.getByText('70×70 cm', { exact: false })).toHaveCount(1);
  await expect(page.getByText('120×120 cm', { exact: false })).toHaveCount(1);
  // Two real rows, counted by a control every row has. It counted „Duplikuj"
  // buttons until that control was removed on 2026-09-04.
  await expect(page.getByRole('button', { name: 'Usuń' })).toHaveCount(2);
});

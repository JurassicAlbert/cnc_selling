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
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();
  await expect(page).toHaveURL('/koszyk');
}

/**
 * This test used to assert the opposite - that "Duplikuj" created a real
 * second, independent line. The owner reversed that on 2026-08-30:
 * "duplicate the same product in basket like separate product since its the
 * same only the quantity should change." Rewritten rather than deleted, so
 * the reversal stays visible to anyone who remembers the old rule.
 */
test('duplicating a cart row raises its quantity instead of creating a second identical line', async ({ page }) => {
  await addToCart(page);

  await expect(page.getByText('70×70 cm', { exact: false })).toHaveCount(1);

  await page.getByRole('button', { name: 'Duplikuj' }).click();
  await expect(page).toHaveURL('/koszyk');

  // Still ONE line - proven by the single control pair, not just by the
  // dimensions text, which a second identical row would also render once.
  await expect(page.getByRole('button', { name: 'Duplikuj' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Usuń' })).toHaveCount(1);
  await expect(page.getByText('70×70 cm', { exact: false })).toHaveCount(1);
  // And the quantity carries what the duplicate added.
  await expect(page.getByText('2 produkty w koszyku')).toBeVisible();
});

/**
 * `docs/CHECKLIST.md` §36's "120 × 120 cm product" - this product's real
 * seeded envelope (`prisma/seed.ts`) is exactly `minWidthMm: 200,
 * maxWidthMm: 1200, minHeightMm: 200, maxHeightMm: 1200` - 120×120cm isn't
 * an arbitrary large size, it's the literal maximum on both axes at once
 * (the real "Duży" preset), the actual boundary this edge case means to
 * exercise.
 */
test('a product configured at its real maximum size (120×120cm) prices and adds to cart', async ({ page }) => {
  await addToCart(page, 'Duży');
  await expect(page.getByText('120×120 cm', { exact: false })).toBeVisible();
});

/**
 * 2026-08-29, owner feedback: "dodaj odpowiednie testy jeśli jeszcze nie ma
 * żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu" - the
 * real-browser proof to go with `tests/unit/cart-quantity.test.ts`'s pure
 * assertion: typing an absurd quantity directly into the cart's own field
 * and submitting is clamped server-side (`updateCartItemQuantity`), not
 * just prevented by the input's own `max` attribute (which a real POST can
 * bypass entirely).
 */
test('typing an absurd quantity into the cart is clamped to the real maximum, not accepted as-is', async ({ page }) => {
  await addToCart(page);
  const main = page.getByRole('main');

  const quantityInput = main.getByRole('spinbutton', { name: 'Ilość' });
  await quantityInput.fill('10000');
  await main.getByRole('button', { name: 'Aktualizuj' }).click();
  await expect(page).toHaveURL('/koszyk');

  await expect(page.getByRole('spinbutton', { name: 'Ilość' })).not.toHaveValue('10000');
  await expect(page.getByRole('spinbutton', { name: 'Ilość' })).toHaveValue('25');
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
  await expect(page.getByRole('button', { name: 'Duplikuj' })).toHaveCount(2);
});

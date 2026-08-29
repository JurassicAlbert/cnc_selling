import { expect, test } from '@playwright/test';

/**
 * `docs/CHECKLIST.md` §36's "Duplicate configuration" and "Two different
 * configurations of the same product in one cart" — real gaps: both
 * `duplicateCartItem` (`server/actions/cart.ts`) and the ability to add
 * the same product twice with different selections had no test coverage
 * at all before this. Same wall-art product/size this session already
 * verified prices cleanly (`checkout.spec.ts`'s own comment), plus a
 * second, deliberately different size for the "two configurations" half.
 *
 * `/koszyk`'s quantity/duplicate/remove controls are each a real
 * zero-client-JS `<form action={...}>` bound directly to a Server Action
 * (`koszyk/page.tsx`'s own header comment) — no client-side race to guard
 * against here, unlike the reupload form; a plain `.click()` and Playwright's
 * default navigation waiting is enough.
 *
 * 2026-08-28: the configurator no longer gates one step at a time behind
 * "Dalej" (owner feedback — every section is a real, always-visible
 * swatch/field picker, like choosing a t-shirt colour) — every
 * swatch/field below is clicked/filled directly, in any order.
 *
 * 2026-08-29: DESIGN/MATERIAL/FINISH/SIZE moved into a breadcrumb trail —
 * each is now a crumb `<button>` that opens a `Menu` (DESIGN/MATERIAL/
 * FINISH) or a `Popover` (SIZE). Both render in a React portal outside
 * `<main>`, so their contents are queried unscoped (`page.getByRole`), not
 * `main.getByRole` — the crumb buttons themselves stay inside `<main>`.
 */

async function addToCart(page: import('@playwright/test').Page, widthCm: string, heightCm: string): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'Wzór' }).click();
  await page.getByRole('menuitem', { name: 'Wzór podstawowy — do zastąpienia' }).click();

  await main.getByRole('button', { name: 'Materiał' }).click();
  await page.getByRole('menuitem', { name: 'Dąb', exact: true }).click();

  await main.getByRole('button', { name: 'Wymiary' }).click();
  await page.getByRole('textbox', { name: 'Szerokość (cm)' }).fill(widthCm);
  await page.getByRole('textbox', { name: 'Szerokość (cm)' }).blur();
  await page.getByRole('textbox', { name: 'Wysokość (cm)' }).fill(heightCm);
  await page.getByRole('textbox', { name: 'Wysokość (cm)' }).blur();

  await main.getByRole('button', { name: 'Wykończenie' }).click();
  await page.getByRole('menuitem', { name: 'Olejowanie' }).click();

  // Personalizacja — optional, left blank.

  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();
  await expect(page).toHaveURL('/koszyk');
}

test('duplicating a cart row creates a real second, independent line item', async ({ page }) => {
  await addToCart(page, '70', '50');

  const rows = page.getByText('70×50 cm', { exact: false });
  await expect(rows).toHaveCount(1);

  await page.getByRole('button', { name: 'Duplikuj' }).click();
  await expect(page).toHaveURL('/koszyk');

  // Real proof it's a second row, not the same one re-rendered: two
  // independent "Duplikuj"/"Usuń" button pairs now exist.
  await expect(page.getByRole('button', { name: 'Duplikuj' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Usuń' })).toHaveCount(2);
  await expect(page.getByText('70×50 cm', { exact: false })).toHaveCount(2);

  // Each is independently removable — deleting one leaves exactly one behind.
  await page.getByRole('button', { name: 'Usuń' }).first().click();
  await expect(page).toHaveURL('/koszyk');
  await expect(page.getByRole('button', { name: 'Duplikuj' })).toHaveCount(1);
});

/**
 * `docs/CHECKLIST.md` §36's "120 × 120 cm product" — this product's real
 * seeded envelope (`prisma/seed.ts`) is exactly `minWidthMm: 200,
 * maxWidthMm: 1200, minHeightMm: 200, maxHeightMm: 1200` — 120×120cm isn't
 * an arbitrary large size, it's the literal maximum on both axes at once,
 * the actual boundary this edge case means to exercise.
 */
test('a product configured at its real maximum size (120×120cm) prices and adds to cart', async ({ page }) => {
  await addToCart(page, '120', '120');
  await expect(page.getByText('120×120 cm', { exact: false })).toBeVisible();
});

test('adding the same product twice with different dimensions creates two separate line items', async ({ page }) => {
  await addToCart(page, '70', '50');
  await expect(page.getByText('70×50 cm', { exact: false })).toHaveCount(1);

  // A deliberately different size for the same product/material/finish —
  // real proof this doesn't merge into (or overwrite) the first row: each
  // `Configuration` is its own row, keyed by its own id, not by product.
  await addToCart(page, '80', '60');

  await expect(page.getByText('70×50 cm', { exact: false })).toHaveCount(1);
  await expect(page.getByText('80×60 cm', { exact: false })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Duplikuj' })).toHaveCount(2);
});

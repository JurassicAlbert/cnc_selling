import { expect, test } from '@playwright/test';

/**
 * The P5 add-to-cart -> cart -> checkout -> confirmation path, end to end,
 * against a production build and the real seeded catalogue — the same
 * "click through by visible Polish label" style as `shell.spec.ts`,
 * deliberately not hardcoded catalogue ids (those are cuids that would
 * silently break this test if the seed ever regenerates them). Uses the
 * wall-art product at 700x500mm specifically: verified by hand this session
 * to price cleanly with no feasibility-blocking findings, unlike several
 * other seeded product/size combinations that do (a real, pre-existing
 * data fact about the placeholder design's line width relative to its
 * reference size, not a bug this test works around).
 *
 * Each Playwright test gets its own fresh cookie jar, so the guest session
 * this creates never collides with another test's cart. This test DOES
 * create a real `Order` row in the dev database on every run — the same
 * database every other e2e test and this session's manual verification
 * already writes to; there is no separate throwaway e2e database in this
 * project.
 *
 * 2026-08-28: the configurator no longer gates one step at a time behind
 * "Dalej" (owner feedback — every section is now a real, always-visible
 * swatch/field picker, like choosing a t-shirt colour). This test now
 * clicks every swatch/fills every field directly, in the same order as
 * before, but with no "Dalej" clicks between them.
 */
test('adds a configuration to the cart and completes checkout as a guest', async ({ page }) => {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');

  const main = page.getByRole('main');

  // Wzór (design)
  await main.getByRole('button', { name: 'Wzór podstawowy — do zastąpienia' }).click();

  // Materiał
  await main.getByRole('button', { name: 'Dąb', exact: true }).click();

  // Wymiary — a size verified to price with no blocking feasibility issues.
  await main.getByLabel('Szerokość (cm)').fill('70');
  await main.getByLabel('Szerokość (cm)').blur();
  await main.getByLabel('Wysokość (cm)').fill('50');
  await main.getByLabel('Wysokość (cm)').blur();

  // Wykończenie
  await main.getByRole('button', { name: 'Olejowanie' }).click();

  // Personalizacja — optional, left blank.

  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();

  await expect(page).toHaveURL('/koszyk');
  await expect(page.getByRole('heading', { name: 'Koszyk' })).toBeVisible();
  await expect(page.getByText('Obraz drewniany z grawerem')).toBeVisible();

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');

  await page.getByLabel('E-mail').fill('e2e-checkout@example.com');
  await page.getByLabel('Imię').fill('Test');
  await page.getByLabel('Nazwisko').fill('E2E');
  await page.getByLabel('Ulica i numer').fill('Testowa 1');
  await page.getByLabel('Kod pocztowy').fill('00-001');
  await page.getByLabel('Miejscowość').fill('Warszawa');
  await page.getByLabel('Akceptuję regulamin sklepu.').check();
  await page.getByText('Przyjmuję do wiadomości, że produkty wykonywane na indywidualne').click();

  await page.getByRole('button', { name: 'Złóż zamówienie' }).click();

  await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible();
  await expect(page.getByText('Numer zamówienia:')).toBeVisible();
  await expect(page).toHaveURL(/\/zamowienie\/\d{4}%2F\d{2}%2F\d{4}\?token=/);
});

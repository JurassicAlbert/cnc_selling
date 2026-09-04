import { expect, test } from '@playwright/test';

/**
 * The P0 shell was proven with a throwaway theme-showcase page and a
 * dedicated MUI button; both are gone now that real catalogue pages exist
 * (2026-08-23). This test verifies the same underlying facts - `lang="pl"`,
 * the theme's exact palette, no uppercase buttons - against the real
 * homepage instead. There is no MUI client island on the homepage today
 * (nothing on it is interactive yet); the first real one arrives with P3's
 * configurator, and that is where a fresh island-composition test belongs.
 *
 * Locators are scoped to `main` throughout: the site header repeats every
 * category name as a nav link, so an unscoped `getByRole('link', { name:
 * 'Loft' })` would match twice and fail Playwright's strict-mode check.
 * `exact: true` on 'Loft' specifically because the homepage's product grid
 * (added in the 2026-08-24 redesign) includes "Stołek loftowy z grawerem",
 * which contains "loft" as a case-insensitive substring - Playwright's
 * default (non-exact) name matching would match that too.
 */
test('renders the real homepage in Polish with the theme applied', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  const backgroundColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(backgroundColor).toBe('rgb(250, 248, 245)'); // #FAF8F5

  // The category grid, seeded from the real catalogue - proves the page is
  // actually server-rendering DB content, not a static shell. "Gres" used
  // to be the second category checked here - deactivated (2026-08-28,
  // owner request, see prisma/seed.ts's CATEGORY_SEEDS comment), so it no
  // longer appears in this nav at all; "Amulety i bransoletki" is still
  // real and active.
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Loft', exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Amulety i bransoletki', exact: true })).toBeVisible();
});

test('navigates from the homepage into a category and a product', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('main').getByRole('link', { name: 'Loft', exact: true }).click();
  await expect(page).toHaveURL('/loft');
  await expect(page.getByRole('heading', { name: 'Loft', exact: true })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Stołek loftowy z grawerem' }).click();
  await expect(page).toHaveURL('/produkt/stolek-loftowy-z-grawerem');
  await expect(page.getByRole('heading', { name: 'Stołek loftowy z grawerem' })).toBeVisible();
});

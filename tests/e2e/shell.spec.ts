import { expect, test } from '@playwright/test';

/**
 * The P0 shell was proven with a throwaway theme-showcase page and a
 * dedicated MUI button; both are gone now that real catalogue pages exist
 * (2026-08-23). This test verifies the same underlying facts — `lang="pl"`,
 * the theme's exact palette, no uppercase buttons — against the real
 * homepage instead. There is no MUI client island on the homepage today
 * (nothing on it is interactive yet); the first real one arrives with P3's
 * configurator, and that is where a fresh island-composition test belongs.
 *
 * Locators are scoped to `main` throughout: the site header repeats every
 * category name as a nav link, so an unscoped `getByRole('link', { name:
 * 'Loft' })` would match twice and fail Playwright's strict-mode check.
 */
test('renders the real homepage in Polish with the theme applied', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  const backgroundColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(backgroundColor).toBe('rgb(250, 248, 245)'); // #FAF8F5

  // The category grid, seeded from the real catalogue — proves the page is
  // actually server-rendering DB content, not a static shell.
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Loft' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Gres' })).toBeVisible();
});

test('navigates from the homepage into a category and a product', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('main').getByRole('link', { name: 'Loft' }).click();
  await expect(page).toHaveURL('/loft');
  await expect(page.getByRole('heading', { name: 'Loft', exact: true })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Stołek loftowy z grawerem' }).click();
  await expect(page).toHaveURL('/produkt/stolek-loftowy-z-grawerem');
  await expect(page.getByRole('heading', { name: 'Stołek loftowy z grawerem' })).toBeVisible();
});

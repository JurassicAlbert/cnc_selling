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
 * 'Obrazy' })` would match twice and fail Playwright's strict-mode check.
 * `exact: true` for the same reason one level down - the homepage's product
 * grid (added in the 2026-08-24 redesign) carries product names that contain
 * the category name as a substring, and Playwright's default name matching
 * is a substring match.
 *
 * This spec used to navigate through Loft. The owner retired that category
 * on 2026-09-04 ("powinniśmy z kategorii wyłączyć na razie loft") and this
 * was not updated with it, so both tests failed against a homepage that was
 * behaving exactly as asked. Repointed at Obrazy, which is real and active.
 * Retiring a category is a routine business decision here - Gres went the
 * same way on 2026-08-28 - so the lesson is that this file has to move with
 * the catalogue, not that the catalogue should hold still for it.
 */
test('renders the real homepage in Polish with the theme applied', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  const backgroundColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(backgroundColor).toBe('rgb(250, 248, 245)'); // #FAF8F5

  // The category grid, seeded from the real catalogue - proves the page is
  // actually server-rendering DB content, not a static shell. Both names
  // here are chosen for being active *and* unlikely to be retired: "Gres"
  // was checked here until 2026-08-28 and Loft until 2026-09-04, and each
  // deactivation broke this test rather than the site.
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Obrazy', exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Amulety i bransoletki', exact: true })).toBeVisible();
});

test('navigates from the homepage into a category and a product', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('main').getByRole('link', { name: 'Obrazy', exact: true }).click();
  await expect(page).toHaveURL('/obrazy-drewniane');
  await expect(page.getByRole('heading', { name: 'Obrazy', exact: true })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Obraz drewniany z grawerem' }).click();
  await expect(page).toHaveURL('/produkt/obraz-drewniany-z-grawerem');
  await expect(page.getByRole('heading', { name: 'Obraz drewniany z grawerem' })).toBeVisible();
});

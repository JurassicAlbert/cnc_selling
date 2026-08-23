import { expect, test } from '@playwright/test';

/**
 * A smoke test for the P0 shell, not a customer journey — those arrive with
 * P3+ once there is a real page to test (ARCHITECTURE.md §21.4). This just
 * proves the pieces that were hand-verified during development stay true:
 * `lang="pl"`, the theme's exact palette, and the client island rendering
 * inside a Server Component page.
 */
test('renders the theme shell in Polish with the island composed in', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  const backgroundColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(backgroundColor).toBe('rgb(250, 248, 245)'); // #FAF8F5

  const island = page.getByRole('button', { name: 'Przycisk MUI (wyspa kliencka)' });
  await expect(island).toBeVisible();

  // No uppercase transform — §2.1's "no uppercase buttons" requirement.
  const textTransform = await island.evaluate((el) => getComputedStyle(el).textTransform);
  expect(textTransform).toBe('none');
});

import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-16, resolved by the owner on 2026-09-10: "Both in
 * both places."
 *
 * Blog was linked from the footer and nowhere else; FAQ from the navigation
 * and nowhere else. Each was therefore invisible to anyone who looked in the
 * other half of the page, which is not a rule anybody chose - it is what two
 * separate additions happened to leave behind.
 *
 * Both ends are asserted at both widths, because the navigation is not the
 * same control on a phone: below 900 px those links live inside the burger
 * (RWD-04), so a test that only ever ran on desktop would pass while the new
 * link was unreachable for half the visitors.
 */

const BURGER = 'label[for="nav-burger-toggle"]';

async function openNavigationIfCollapsed(page: import('@playwright/test').Page): Promise<void> {
  const burger = page.locator(BURGER);
  if (await burger.isVisible()) {
    await burger.click();
  }
}

test('the blog is reachable from the navigation, at every width', async ({ page }) => {
  await page.goto('/');
  await openNavigationIfCollapsed(page);

  const nav = page.getByRole('navigation', { name: 'Menu główne' });
  await nav.getByRole('link', { name: 'Blog', exact: true }).click();

  await expect(page).toHaveURL('/blog');
  await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
});

test('the FAQ is reachable from the footer', async ({ page }) => {
  await page.goto('/');

  /*
    Scoped to the footer landmark rather than to the page: „FAQ" is in the
    navigation too - that is the whole point of this item - so an unscoped
    locator would resolve to two links and would pass without the footer
    having gained anything.
  */
  const footer = page.getByRole('contentinfo');
  await footer.getByRole('link', { name: 'FAQ', exact: true }).click();

  await expect(page).toHaveURL('/faq');
});

test('each still appears in the place it already lived', async ({ page }) => {
  // A guard on what the change must not take away: the footer keeps its blog
  // link and the navigation keeps its FAQ link.
  await page.goto('/');

  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Blog', exact: true })).toBeVisible();

  await openNavigationIfCollapsed(page);
  const nav = page.getByRole('navigation', { name: 'Menu główne' });
  await expect(nav.getByRole('link', { name: 'FAQ', exact: true })).toBeVisible();
});

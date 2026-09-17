import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * UX-23's header and cart-view chrome, in a real browser.
 *
 * The owner asked for the `template.getbazaar.io` arrangement: a slim topbar
 * above the navigation, a search field that owns the centre of the header
 * with a category selector attached to it, a cart laid out as line cards
 * beside a summary panel, and the categories reachable from the cart view.
 *
 * What is pinned here is deliberately not "it looks like the reference".
 * Screenshots of a layout are not worth a test. What is worth a test is the
 * behaviour that a layout change can silently break, and this one broke two
 * things on the way in:
 *
 * - the category menu has to actually take you to the category, and the
 *   search form must not smuggle a category nobody chose into its URL;
 * - the strip above the navigation must show a social profile only when one
 *   is configured, or it links customers to accounts nobody has claimed;
 * - hiding the header labels to fit a phone took the cart link's accessible
 *   name with them. `display: none` removes text from the accessibility
 *   tree, so the link was announced as „1" - its count badge and nothing
 *   else. Playwright's `getByRole(name)` runs a real accessible-name
 *   computation, which is the only honest way to assert the fix.
 *
 * Both browser projects run this: the labels are hidden by a media query, so
 * the mobile project is the one that exercises the interesting branch.
 */

/**
 * Rewritten 2026-09-04. The topbar used to carry links to our own FAQ and
 * contact pages, and this test held them there. The owner corrected what the
 * strip is for - "navbar nad navbarem dotyczy mediów fb insta itd nie
 * podstron" - so it now carries the shop's social profiles instead.
 *
 * Which changes what is worth pinning. The links are `StoreSettings` fields
 * the owner fills in, because hard-coding a profile URL would be inventing
 * an account that may not exist. So the rule under test is the one that
 * makes that safe: **nothing is shown for a profile nobody configured.** A
 * social icon linking nowhere is worse than no icon.
 *
 * Driven through the real setting rather than asserted against whatever the
 * database happens to hold, and restored afterwards - `StoreSettings` is a
 * singleton every other spec in this run shares.
 */
test('the topbar shows a social profile only when one is actually configured', async ({ page }) => {
  const before = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });

  try {
    await prisma.storeSettings.update({
      where: { id: 1 },
      data: { facebookUrl: null, instagramUrl: null, tiktokUrl: null, youtubeUrl: null },
    });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /mediach społecznościowych/ })).toHaveCount(0);

    await prisma.storeSettings.update({
      where: { id: 1 },
      data: { facebookUrl: 'https://www.facebook.com/rytpl' },
    });
    await page.goto('/');

    const social = page.getByRole('navigation', { name: /mediach społecznościowych/ });
    const facebook = social.getByRole('link', { name: 'Facebook' });
    await expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/rytpl');
    // It leaves our site: without `noopener` the opened page gets a handle on
    // ours through `window.opener`.
    await expect(facebook).toHaveAttribute('rel', /noopener/);
    // And only the one that was configured.
    await expect(social.getByRole('link')).toHaveCount(1);
  } finally {
    await prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        facebookUrl: before.facebookUrl,
        instagramUrl: before.instagramUrl,
        tiktokUrl: before.tiktokUrl,
        youtubeUrl: before.youtubeUrl,
      },
    });
  }
});

test('the cart link keeps its accessible name when its label is hidden to fit', async ({ page }) => {
  await page.goto('/');

  // Not `toBeVisible`: below 600px the label is clipped to a pixel, which is
  // the point. What must survive is the NAME, and `getByRole` is what
  // computes it the way a screen reader would.
  //
  // Scoped to the header since RWD-05, which put a second cart link in the
  // mobile bottom navigation. Two links named „Koszyk" is the intended state
  // - a shopper should reach the cart from either - so the fix is for this
  // test to say which one it means, not for one of them to be renamed.
  await expect(page.getByRole('banner').getByRole('link', { name: /Koszyk/ })).toHaveAttribute('href', '/koszyk');
});

/**
 * Rewritten 2026-09-04. The category list used to be a `<select name="k">`
 * inside the search form, and this test proved it really narrowed the
 * results - a control that appears to filter and does not being the same
 * class of thing as a price we will not honour.
 *
 * The owner then took that job away from it: "nie potrzebujemy listy
 * rozwijanej kategorii jako opcji wyszukiwania - wyszukiwanie dobrze sobie
 * radzi bez tego, za to możemy tą listę rozwijaną kategorii traktować jako
 * quick access". So the rule under test changed with it: the menu must take
 * you to the category.
 *
 * **Split in two and made width-aware, 2026-09-09 (RWD-04).** The band that
 * holds this menu is desktop-only now, so the menu genuinely does not exist
 * on a phone - what replaces it there is the burger's „Produkty" list, and
 * `mobile-rwd.spec.ts` asserts every category is still reachable through it.
 * Skipped rather than deleted: the desktop projects still have a real
 * control to check, and a test that quietly passes at one width because the
 * thing it tests is missing is worse than one that says so.
 */
test('the category menu is quick access to a category', async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 900,
    'The search band is hidden below 900px (RWD-04); the burger carries the categories there.',
  );

  await page.goto('/');

  // Opened the way a customer opens it. The menu is a `<details>` - zero
  // client JS - so its links genuinely are not in reach until the summary is
  // pressed, and a test that reached past that would be proving nothing
  // about what a visitor can actually do.
  const menu = page.getByRole('navigation', { name: 'Kategorie' });
  await menu.getByText('Kategorie', { exact: true }).click();
  await menu.getByRole('link', { name: 'Obrazy', exact: true }).click();

  await expect(page).toHaveURL('/obrazy-drewniane');
  await expect(page.getByRole('heading', { name: 'Obrazy', exact: true })).toBeVisible();
});

/**
 * The half worth having most: a leftover `k=` on a form that no longer offers
 * the choice would put a filter nobody selected into every shared search URL.
 *
 * This one runs at both widths, because the form runs at both widths - the
 * same `SearchForm`, in the band on a desktop and behind the header's
 * magnifier on a phone. Which is the point of there being one component:
 * a category creeping back into the query string has to fail here whichever
 * way the visitor reached the field.
 */
test('the search form carries no category', async ({ page }) => {
  await page.goto('/');

  // Below 900px the field is behind the header's toggle, and revealing it is
  // what a visitor on a phone does. Above it the toggle is `display: none`,
  // so there is nothing to press and the band's field is already there.
  const toggle = page.locator('label[for="header-search-toggle"]');
  if (await toggle.isVisible()) await toggle.click();

  await page.getByRole('searchbox').fill('obraz');
  await page.getByRole('button', { name: 'Szukaj' }).click();

  await expect(page).toHaveURL(/\/szukaj\?/);
  // The phrase, and nothing else. `searchActiveProducts` still accepts a
  // category and `/szukaj?k=…` remains a working deep link - what changed is
  // that no control here sends one.
  await expect(page).not.toHaveURL(/[?&]k=/);
});

test('choosing a category with no phrase lists that category', async ({ page }) => {
  // A real request - someone picked from the selector and pressed the
  // button. Answering it with nothing would make the selector a dead end.
  await page.goto('/szukaj?q=&k=obrazy-drewniane');

  await expect(page.getByText('Wszystko w kategorii', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Obraz drewniany z grawerem/ })).toBeVisible();
});

test('a stale category link says so instead of quietly searching everything', async ({ page }) => {
  await page.goto('/szukaj?q=obraz&k=nie-ma-takiej-kategorii');

  await expect(page.getByText('Wybrana kategoria nie jest już dostępna', { exact: false })).toBeVisible();
  // And nothing is listed, rather than the unfiltered results the customer
  // did not ask for.
  await expect(page.getByRole('link', { name: /Obraz drewniany z grawerem/ })).toHaveCount(0);
});

test('the cart view offers a way back into the catalogue, even when empty', async ({ page }) => {
  // The empty cart is where this matters most: „Twój koszyk jest pusty"
  // plus a single link was a dead end.
  await page.goto('/koszyk');

  const rail = page.getByRole('navigation', { name: 'Przeglądaj dalej' });
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('link', { name: 'Obrazy', exact: true })).toHaveAttribute(
    'href',
    '/obrazy-drewniane',
  );
});

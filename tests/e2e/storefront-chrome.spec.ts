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
 * - the category selector has to actually narrow the search, or it is a
 *   control that pretends to work;
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
  await expect(page.getByRole('link', { name: /Koszyk/ })).toHaveAttribute('href', '/koszyk');
});

test('the category selector narrows the search for real', async ({ page }) => {
  await page.goto('/');

  // „Obrazy" holds the wall-art products; „Amulety i bransoletki" holds the
  // jewellery. A search for „obraz" scoped to the jewellery category must
  // come back empty, which no amount of decoration could fake.
  await page.getByLabel('Kategoria').selectOption({ label: 'Amulety i bransoletki' });
  await page.getByRole('searchbox').fill('obraz');
  await page.getByRole('button', { name: 'Szukaj' }).click();

  await expect(page).toHaveURL(/\/szukaj\?/);
  await expect(page).toHaveURL(/k=amulety-i-bransoletki/);
  await expect(page.getByText('Nic nie pasuje do tej frazy', { exact: false })).toBeVisible();

  // The same phrase in the category that does hold it finds something, so
  // the assertion above is about the filter rather than about the search
  // being broken.
  await page.goto('/szukaj?q=obraz&k=obrazy-drewniane');
  await expect(page.getByRole('link', { name: /Obraz drewniany z grawerem/ })).toBeVisible();
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

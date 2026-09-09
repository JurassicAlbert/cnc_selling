import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` RWD-05 - no bottom navigation on mobile.
 *
 * The owner's reference (`template.getbazaar.io`) keeps Home / Category /
 * Cart-with-its-count / Account pinned to the bottom of every page on a
 * phone, and citing that template is how the owner pointed at this. Ours
 * reached all four only through the burger menu or by scrolling to the
 * footer.
 *
 * The destinations are mapped to pages this shop actually has rather than
 * copied by name: „Kolekcje" takes the reference's "Category" slot, because
 * `/kolekcje` is a real browsing page here while categories are already one
 * tap away from both the burger and the home grid.
 *
 * Phone width only. Above the burger's own 900 px breakpoint the full
 * navigation is on screen and a second copy of it would be noise.
 */

test.use({ viewport: { width: 375, height: 812 } });

const DESTINATIONS: ReadonlyArray<readonly [string, string]> = [
  ['Strona główna', '/'],
  ['Kolekcje', '/kolekcje'],
  ['Koszyk', '/koszyk'],
  ['Konto', '/moje-konto'],
];

const FROM = ['/', '/obrazy-drewniane', '/koszyk', '/produkt/obraz-drewniany-z-grawerem'];

for (const from of FROM) {
  test(`every destination is one tap away from ${from}`, async ({ page }) => {
    test.slow();
    await page.goto(from);

    const nav = page.getByRole('navigation', { name: 'Nawigacja dolna' });
    await expect(nav).toBeVisible();

    for (const [label, href] of DESTINATIONS) {
      const link = nav.getByRole('link', { name: new RegExp(label) });
      await expect(link).toHaveAttribute('href', href);
      // Reachable without opening anything: visible, and big enough to hit.
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
}

test('the bar is a labelled landmark, and gone on a desktop width', async ({ page }) => {
  await page.goto('/');
  // `accessibility.spec.ts` requires every navigation landmark to be named;
  // this asserts the name is the one a screen reader will read out, not just
  // that some name exists.
  await expect(page.getByRole('navigation', { name: 'Nawigacja dolna' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('navigation', { name: 'Nawigacja dolna' })).toBeHidden();
});

test('the cart count on the bar is the real one', async ({ page }) => {
  test.slow();
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const addToCart = page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 30_000 });
  await addToCart.click();
  await expect(page).toHaveURL('/koszyk');

  // The same server-side summary the header badge uses, not a second source
  // that can disagree with it.
  const nav = page.getByRole('navigation', { name: 'Nawigacja dolna' });
  await expect(nav.getByRole('link', { name: /Koszyk/ })).toContainText('1');
});

test('the product page price bar sits above the bar, not under it', async ({ page }) => {
  /*
    Two things now want the bottom of the viewport. Stacked rather than one
    hiding the other: a customer configuring a product needs the price AND a
    way off the page, and „whichever loads last wins" is not a layout.
  */
  test.slow();
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  await page.getByRole('button', { name: 'Tylko niezbędne' }).click();
  await expect(page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' })).toBeEnabled({
    timeout: 30_000,
  });

  const geometry = await page.evaluate(() => {
    const nav = document.querySelector('nav[data-bottom-nav]');
    const bar = [...document.querySelectorAll('div')].find(
      (el) => getComputedStyle(el).position === 'fixed' && (el.textContent ?? '').includes('Cena'),
    );
    if (nav === null || bar === undefined) return null;
    const n = nav.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { navTop: Math.round(n.top), navBottom: Math.round(n.bottom), barBottom: Math.round(b.bottom), viewport: window.innerHeight };
  });

  expect(geometry).not.toBeNull();
  if (geometry === null) return;
  expect(geometry.navBottom).toBe(geometry.viewport);
  // The price bar ends exactly where the navigation begins - no overlap, and
  // no gap showing the page through between them.
  expect(geometry.barBottom).toBe(geometry.navTop);
});

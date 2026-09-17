import 'dotenv/config';

import { expect, test } from '@playwright/test';
import { addToCart, addToCartButton, waitForAddToCartReady } from './add-to-cart';

/**
 * `docs/AI-CHECKLIST.md`'s mobile/RWD sweep, 2026-09-09.
 *
 * Everything here was found by measuring a production build at 375x812
 * alongside the owner's own reference (`template.getbazaar.io`) at the same
 * size, and every assertion checks the property that actually decides the
 * behaviour rather than something that correlates with it: what element is at
 * a point, what a field's `autocomplete` says, what an input's `type` is.
 *
 * Only run at phone width - `test.use` below - because both defects are
 * invisible above the breakpoint. That is the whole reason they lasted.
 */

test.use({ viewport: { width: 375, height: 812 } });

test('the fixed price bar does not sit on top of the end of the page', async ({ page }) => {
  /*
    RWD-01. The product page pins a 51 px price bar to the bottom of the
    viewport and the document had no matching bottom padding, so scrolled to
    the end the bar covered the last line of the footer - measured with
    `elementFromPoint`, which is the same question a thumb asks.

    Only „© 2026 RYT" was lost today, which is mild. The mechanism is not:
    anything that ends up in the last 51 px of any product page is
    unreachable, and every product page has this bar.
  */
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  /*
    The consent banner is dismissed first, and finding out why is part of the
    record: on a fresh visit it ALSO sits across the bottom of the page, so
    the first version of this test caught „Tylko niezbędne" covering the
    copyright rather than the price bar. That is a real second overlay in the
    same 51 px, but it is dismissible and the price bar is not - so the bar is
    what this asserts, from the state a customer is in for all but their first
    page view.
  */
  await page.getByRole('button', { name: 'Tylko niezbędne' }).click();

  // The bar only exists once the configurator has priced something.
  await waitForAddToCartReady(addToCartButton(page));

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);

  const verdict = await page.evaluate(() => {
    const copyright = [...document.querySelectorAll('footer *')].find(
      (el) => el.children.length === 0 && (el.textContent ?? '').includes('©'),
    );
    if (copyright === undefined) return { found: false } as const;
    const box = copyright.getBoundingClientRect();
    const atCentre = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      found: true,
      visible: box.top >= 0 && box.bottom <= window.innerHeight,
      // The thing a finger would actually hit where that text is drawn.
      coveredBy: atCentre === null ? null : (atCentre.textContent ?? '').trim().slice(0, 40),
      ownText: (copyright.textContent ?? '').trim(),
    } as const;
  });

  expect(verdict.found).toBe(true);
  if (!verdict.found) return;
  expect(verdict.visible).toBe(true);
  expect(verdict.coveredBy).toContain(verdict.ownText);
});

/**
 * RWD-02. Fourteen fields across three forms had no `autocomplete` at all.
 *
 * The token is what a phone keyboard and a password manager read: without it
 * a saved address is nine fields of thumb-typing, and a browser will neither
 * offer to save a new password nor fill an existing one. Asserted in the
 * browser rather than by reading the source, because an attribute that never
 * reaches the DOM is the failure being guarded against.
 */
const CHECKOUT_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['email', 'email'],
  ['phone', 'tel'],
  ['firstName', 'given-name'],
  ['lastName', 'family-name'],
  ['companyName', 'organization'],
  ['street', 'street-address'],
  ['postalCode', 'postal-code'],
  ['city', 'address-level2'],
];

const AUTOCOMPLETE: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  [
    '/rejestracja',
    [
      ['name', 'name'],
      ['email', 'email'],
      ['password', 'new-password'],
    ],
  ],
  [
    '/logowanie',
    [
      ['email', 'email'],
      ['password', 'current-password'],
    ],
  ],
];

for (const [path, fields] of AUTOCOMPLETE) {
  test(`every field on ${path} tells the browser what it holds`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(`input[name="${fields[0]?.[0]}"]`)).toBeVisible();

    const actual = await page.evaluate(
      (names) =>
        names.map((name) => [name, document.querySelector(`input[name="${name}"]`)?.getAttribute('autocomplete') ?? null]),
      fields.map(([name]) => name),
    );

    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(fields.map(([n, v]) => [n, v])));
  });
}

test('every field on the checkout tells the browser what it holds', async ({ page }) => {
  // The checkout only exists with something to buy - reached the way a
  // customer reaches it rather than by navigating straight to the URL, which
  // is why this one is separate from the two above.
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  await addToCart(page);
  await expect(page).toHaveURL('/koszyk');
  await page.goto('/koszyk/zamowienie');

  await expect(page.locator('input[name="email"]')).toBeVisible();

  const actual = await page.evaluate(
    (names) =>
      names.map((name) => [name, document.querySelector(`input[name="${name}"]`)?.getAttribute('autocomplete') ?? null]),
    CHECKOUT_FIELDS.map(([name]) => name),
  );

  expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(CHECKOUT_FIELDS.map(([n, v]) => [n, v])));
});

/**
 * RWD-04 / UX-14. Measured on this build at 375x812: `main` starts 206 px
 * down the page on every route, which is a quarter of the screen spent
 * before the page says anything. The owner's own reference
 * (`template.getbazaar.io`) spends about 104 px and reaches search through
 * an icon.
 *
 * 128 of those 206 px are the search band alone - it stacks into two rows
 * under 600 px, the category pill above the field - and it renders on the
 * cart, the checkout and every account page, where a product search is not
 * what anyone is about to do.
 *
 * The budget is deliberately not pinned to the exact height the header
 * happens to have. What it forbids is a second full-width band creeping back
 * in above the content; 120 px leaves room for the strip plus the header at
 * every width this runs at, and nothing else.
 */
const CHROME_BUDGET_PX = 120;

for (const path of ['/', '/koszyk', '/obrazy-drewniane']) {
  test(`the chrome above ${path} leaves the screen to the page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('#tresc')).toBeVisible();

    // Where the content actually begins, which is the thing a visitor sees -
    // not the sum of the parts, which would miss margins and borders.
    const contentTop = await page.evaluate(() =>
      Math.round(document.querySelector('main')?.getBoundingClientRect().top ?? -1),
    );

    expect(contentTop).toBeGreaterThan(0);
    expect(contentTop).toBeLessThan(CHROME_BUDGET_PX);
  });
}

/*
  The visible control is a `<label>`, not a button: the disclosure is a
  checkbox and its label, the zero-JS pattern the burger beside it already
  uses (`theme-vars.css`, "Responsive navigation"). `SiteHeader` is a Server
  Component with no client JavaScript at all, so there is no handler to hang
  a real button off. The checkbox carries the accessible name; the label is
  what a thumb lands on, so it is what a test presses.
*/
const SEARCH_TOGGLE = 'label[for="header-search-toggle"]';

test('search is one tap away from a page that is not the shop front', async ({ page }) => {
  await page.goto('/koszyk');
  await expect(page.locator('#tresc')).toBeVisible();

  /*
    Nothing to type into until it is asked for. `getByRole` only matches what
    is in the accessibility tree, so the band's field - still in the DOM,
    hidden by the breakpoint - is correctly not counted here. That is the
    same question a screen reader asks.
  */
  await expect(page.getByRole('searchbox')).toHaveCount(0);

  await page.locator(SEARCH_TOGGLE).click();

  await page.getByRole('searchbox').fill('obraz');
  await page.getByRole('button', { name: 'Szukaj' }).click();

  await expect(page).toHaveURL(/\/szukaj\?q=obraz/);
  // A real result, not just the results page: a search box that submits to a
  // page listing nothing would satisfy every assertion above it.
  await expect(page.getByRole('link', { name: /Obraz drewniany z grawerem/ })).toBeVisible();
});

/**
 * The other half of what the band was doing: „Kategorie" was quick access to
 * a category page, and on a phone that list has to survive the band's
 * removal.
 *
 * This one passes before the change as well as after, and is written down as
 * exactly that - a guard on what the change takes away, not a red test.
 * Every category the pill listed is in the burger's „Produkty" menu, which
 * is where it was already duplicated.
 */
test('every category the band offered is still reachable on a phone', async ({ page }) => {
  await page.goto('/');

  await page.locator('label[for="nav-burger-toggle"]').click();

  const menu = page.getByRole('navigation', { name: 'Menu główne' });
  await menu.getByText('Produkty', { exact: true }).click();
  await menu.getByRole('link', { name: 'Obrazy', exact: true }).click();

  await expect(page).toHaveURL('/obrazy-drewniane');
  await expect(page.getByRole('heading', { name: 'Obrazy', exact: true })).toBeVisible();
});

import 'dotenv/config';

import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' })).toBeEnabled({
    timeout: 30_000,
  });

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
  const addToCart = page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 30_000 });
  await addToCart.click();
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

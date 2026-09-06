import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * The P5 add-to-cart -> cart -> checkout -> confirmation path, end to end,
 * against a production build and the real seeded catalogue - the same
 * "click through by visible Polish label" style as `shell.spec.ts`,
 * deliberately not hardcoded catalogue ids (those are cuids that would
 * silently break this test if the seed ever regenerates them). Uses the
 * wall-art product at 700x500mm specifically: verified by hand this session
 * to price cleanly with no feasibility-blocking findings, unlike several
 * other seeded product/size combinations that do (a real, pre-existing
 * data fact about the placeholder design's line width relative to its
 * reference size, not a bug this test works around).
 *
 * Each Playwright test gets its own fresh cookie jar, so the guest session
 * this creates never collides with another test's cart. This test DOES
 * create a real `Order` row in the dev database on every run - the same
 * database every other e2e test and this session's manual verification
 * already writes to; there is no separate throwaway e2e database in this
 * project.
 *
 * 2026-08-28: the configurator no longer gates one step at a time behind
 * "Dalej" (owner feedback - every section is now a real, always-visible
 * swatch/field picker, like choosing a t-shirt colour). This test now
 * clicks every swatch/fills every field directly, in the same order as
 * before, but with no "Dalej" clicks between them.
 *
 * 2026-08-29, owner feedback: "The price for the product should be clear,
 * no waiting for configure - we have price". DESIGN/MATERIAL/WYKOŃCZENIE/
 * WYMIARY now default to a real, already-feasible selection (the product's
 * own first design/material/finish and its middle `ProductPresetSize`, 70×70
 * cm for this product's real seeded envelope) the instant the page loads -
 * verified by hand this session to price cleanly with no feasibility
 * -blocking findings. No crumb click is needed at all; this test goes
 * straight to "Dodaj do koszyka".
 */
test('adds a configuration to the cart and completes checkout as a guest', async ({ page }) => {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');

  const main = page.getByRole('main');
  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();

  await expect(page).toHaveURL('/koszyk');
  await expect(page.getByRole('heading', { name: 'Koszyk' })).toBeVisible();
  // The cart row's own heading, not any text on the page: a bare `getByText`
  // also matches Next's route announcer (`__next-route-announcer__`), which
  // holds the page title for a moment after each navigation. A strict-mode
  // violation that only fires inside that window, so it reads as a browser
  // flake (2026-09-04).
  await expect(page.getByRole('heading', { name: 'Obraz drewniany z grawerem' })).toBeVisible();

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');

  await page.getByLabel('E-mail').fill('e2e-checkout@example.com');
  await page.getByLabel('Telefon').fill('+48123456789');
  await page.getByLabel('Imię').fill('Test');
  await page.getByLabel('Nazwisko').fill('E2E');
  await page.getByLabel('Ulica i numer').fill('Testowa 1');
  await page.getByLabel('Kod pocztowy').fill('00-001');
  await page.getByLabel('Miejscowość').fill('Warszawa');
  await page.getByLabel('Akceptuję regulamin sklepu.').check();
  await page.getByText('Przyjmuję do wiadomości, że produkty wykonywane na indywidualne').click();

  await page.getByRole('button', { name: 'Złóż zamówienie' }).click();

  await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible();
  await expect(page.getByText('Numer zamówienia:')).toBeVisible();
  /*
    BUG-22: the address carries the order number and nothing else.

    This used to assert `?token=` was present, which was the behaviour at the
    time and is now precisely what must not happen - the token in the address
    means it is also in the history, the access log and the `Referer` of every
    link clicked from this page. The assertion is inverted rather than
    deleted, so the guarantee is still pinned.
  */
  await expect(page).toHaveURL(/\/zamowienie\/\d{4}%2F\d{2}%2F\d{4}$/);
  expect(new URL(page.url()).searchParams.get('token')).toBeNull();
});

/**
 * `docs/AI-CHECKLIST.md` BUG-22, the other half.
 *
 * The checkout redirect sets the cookie itself and never puts the token in an
 * address. The **emailed link** cannot do that - it is a plain URL in a mail
 * client - so it still carries `?token=`, and `src/proxy.ts` exchanges it on
 * the way in.
 *
 * That exchange only works on a real document navigation, which is exactly
 * why it needs a browser test rather than a unit one: the first attempt at
 * this fix put the whole thing in the proxy, and it failed because a Server
 * Action's `redirect()` is followed by the client router instead. The unit
 * tests passed throughout. Only the browser noticed.
 *
 * A fresh context, so nothing is carried over from the checkout above - this
 * is a customer opening their confirmation email days later on another
 * device, which is the case the link exists for.
 */
test('the emailed order link works once and leaves no token in the address', async ({ browser }) => {
  test.slow();

  const order = await prisma.order.findFirstOrThrow({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true, accessToken: true },
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(
      `/zamowienie/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(order.accessToken)}`,
    );

    // It renders - the exchange handed the token to the page.
    await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible({ timeout: 15_000 });

    // And the address no longer holds it.
    expect(new URL(page.url()).searchParams.get('token')).toBeNull();

    // The cookie is HttpOnly, which is the point of moving it off the URL:
    // a script on the page cannot read it back out.
    expect(await page.evaluate(() => document.cookie)).not.toContain(order.accessToken);

    // Reloading the clean URL still works, so the customer can stay on the
    // page, refresh, and navigate back to it without the link.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a wrong token shows the not-found page and no order details', async ({ browser }) => {
  /*
    §16.1's "not 403", unchanged by BUG-22: an order's existence must never be
    probeable by guessing tokens against a real order number.

    **Asserted on what is rendered, not on the status code, and that is a
    finding rather than a shortcut.** This test first expected a 404 and got a
    200 - so I checked whether that was my doing, and it is not: every
    `notFound()` on this site answers 200 in a production build, including a
    completely unmatched path. The page is right, the status line is not.
    That is a soft 404, it is sitewide, and it is recorded separately as
    BUG-33 rather than folded in here.

    What matters for this item still holds and is what is pinned: a wrong
    token renders the not-found page and leaks nothing about the order.
  */
  const order = await prisma.order.findFirstOrThrow({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`/zamowienie/${encodeURIComponent(order.orderNumber)}?token=definitely-not-the-token`);

    await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toHaveCount(0);
    await expect(page.getByText(order.orderNumber, { exact: false })).toHaveCount(0);
    // Something rendered rather than the page hanging or erroring. The order
    // route falls through to the storefront's own not-found body, which says
    // the page does not exist - it does not carry a literal „404", and the
    // browser tab still reads „Zamówienie przyjęte" because the route's static
    // metadata applies either way. Both are cosmetic and both are noted in
    // BUG-33 with the status code.
    await expect(page.getByRole('heading', { name: 'Nie znaleziono takiej strony' })).toBeVisible();
  } finally {
    await context.close();
  }
});

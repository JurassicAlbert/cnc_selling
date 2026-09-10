import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` SEC-12.
 *
 * `setOrderAccessCookie` decided `Secure` from
 * `NODE_ENV === 'production' && process.env.E2E !== '1'` - and **nothing in
 * this repository has ever set `E2E`**. The only mention of it was that
 * expression, so the clause was never false and the comment beside it
 * described a guard that did not exist.
 *
 * Correct in production, where the site is https. Wrong everywhere else a
 * production build is served over plain http - a staging box, a LAN preview,
 * a container behind a TLS-terminating proxy, and this suite - because
 * **WebKit accepts a `Secure` cookie over http into the jar and then declines
 * to send it back**. For a guest order token that is a confirmation link
 * which works once and never again. UX-11 hit exactly this with the cart-undo
 * cookie and fixed it by reading the request's own scheme; this is the same
 * rule applied to the credential path.
 *
 * Asserted against the browser's real cookie jar rather than against the
 * `Set-Cookie` header, because the jar is what decides whether the next
 * request carries it - and dumping the jar is how the cart-undo version of
 * this was diagnosed in the first place.
 */
test('the guest order cookie is one the browser will send back', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const addToCart = page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 30_000 });
  await addToCart.click();

  await expect(page).toHaveURL('/koszyk');
  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');

  await page.getByLabel('E-mail').fill('e2e-order-cookie@example.com');
  await page.getByLabel('Telefon').fill('+48123456789');
  await page.getByLabel('Imię').fill('Test');
  await page.getByLabel('Nazwisko').fill('E2E');
  await page.getByLabel('Ulica i numer').fill('Testowa 1');
  await page.getByLabel('Kod pocztowy').fill('00-001');
  await page.getByLabel('Miejscowość').fill('Warszawa');
  await page.getByLabel('Akceptuję regulamin sklepu.').check();
  await page.getByText('Przyjmuję do wiadomości, że produkty wykonywane na indywidualne').click();

  await page.getByRole('button', { name: 'Złóż zamówienie' }).click();
  await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible({ timeout: 30_000 });

  const cookie = (await page.context().cookies()).find((c) => c.name === 'order-access');
  expect(cookie, 'the order-access cookie was not set at all').toBeDefined();
  if (cookie === undefined) return;

  /*
    The assertion this item is about. This suite runs a production build over
    plain http, so a `Secure` cookie here is one the browser is entitled to
    withhold on the next request - and WebKit does exactly that.
  */
  expect(cookie.secure).toBe(false);

  // And a guard on everything that must NOT loosen while that flag changes.
  // This is a bearer token for someone else's order.
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.path).toBe('/zamowienie');
  /*
    `sameSite` is deliberately NOT asserted here. The server sends `Lax` and
    always has; from that identical response Chromium's jar reports „Lax" and
    WebKit's reports „None". That is a difference between the two browsers'
    cookie stores, not a difference in what this application sent, so
    asserting it here would be pinning a browser quirk and would fail on
    mobile-safari forever. What the jar does agree on - and what this item is
    about - is `secure`.
  */

  // It is still doing its job: the confirmation renders on a fresh request
  // that carries nothing but the jar.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get('token')).toBeNull();
});

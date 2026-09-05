import type { Page } from '@playwright/test';
// Not `@playwright/test`: this spec registers accounts, and SEC-01 allows
// one IP ten per day - fewer than a full suite run needs. See fixtures.ts.
import { expect, test } from './fixtures';
import { fillReliably, checkReliably } from './fill-reliably';
import { clearLoopbackRateLimits } from './rate-limit-reset';

/**
 * P6's real point, per the guest-cart-merge plan: adding to cart as a
 * guest must not be lost by registering/logging in. Same product/size
 * combination `checkout.spec.ts` already verified prices cleanly with no
 * feasibility-blocking findings.
 *
 * A fresh, random email per run (Playwright gives each test its own cookie
 * jar, but `User.email` is globally unique in the shared dev database this
 * suite writes to, same as `checkout.spec.ts`'s own header comment notes).
 */

async function register(page: Page, params: { readonly name: string; readonly email: string; readonly password: string }) {
  // Immediately before the submit, not merely once per test. Clearing per
  // test leaves a real race under parallel workers: the counter is shared
  // across all of them, so several tests can each register after the same
  // clear and blow through SEC-01's ten-per-IP together. Seen on 2026-09-04,
  // as a registration that silently stayed on `/rejestracja`. Clearing here
  // shrinks the window to the milliseconds between this call and the click.
  await clearLoopbackRateLimits();
  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), params.name);
  await fillReliably(page.getByLabel('Adres e-mail'), params.email);
  await fillReliably(page.getByLabel('Hasło'), params.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL('/moje-konto');
}

async function login(page: Page, params: { readonly email: string; readonly password: string }) {
  await page.goto('/logowanie');
  // `/logowanie` has TWO "Adres e-mail" fields (password login + the OTP
  // request form below it) - scoped to the form that also has "Hasło",
  // which only the password-login form does.
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), params.email);
  await fillReliably(passwordForm.getByLabel('Hasło'), params.password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL('/moje-konto');
}

// 2026-08-28: the configurator no longer gates one step at a time behind
// "Dalej" (owner feedback - every section is a real, always-visible
// swatch/field picker) - every swatch/field below is clicked/filled
// directly, no "Dalej" clicks between them.
//
// 2026-08-29, owner feedback: "The price for the product should be clear,
// no waiting for configure - we have price". DESIGN/MATERIAL/WYKOŃCZENIE/
// WYMIARY now default to a real, already-feasible selection (the product's
// own first design/material/finish and its middle `ProductPresetSize`) the
// instant the page loads - this test needs nothing beyond that default, so
// it goes straight to "Dodaj do koszyka". No crumb click needed at all.
async function addSampleConfigurationToCart(page: Page): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');
  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();
  await expect(page).toHaveURL('/koszyk');
}

test('guest cart survives registration - no duplicate, no loss', async ({ page }) => {
  /*
    A genuinely long journey, not a hang: register, configure a product, add
    it to the cart, complete checkout, then read the order back. Under four
    parallel workers on WebKit it repeatedly ran out of the 30s default at
    the *last* step, having already done all of the work - which carries no
    information beyond "the machine was busy", and an intermittently red
    suite is one people learn to ignore.

    `slow()` triples the budget rather than shortening what the test proves.
    Same remedy and same reasoning as `design-review-customer.spec.ts`.
    Recorded 2026-09-05 with ARCH-03, which moved the suite onto its own
    database but does nothing about four browsers sharing one Next server -
    that contention is what this is.
  */
  test.slow();

  const email = `e2e-accounts-${Date.now()}@example.test`;

  // The cart row's own heading, not any text on the page. A bare
  // `getByText` also matched Next's route announcer
  // (`__next-route-announcer__`), which carries the page title „Obraz
  // drewniany z grawerem - dąb" for a moment after each navigation - a
  // strict-mode violation that only fires when the assertion lands inside
  // that window, which is why it read as a WebKit flake (2026-09-04).
  const cartRow = page.getByRole('heading', { name: 'Obraz drewniany z grawerem' });

  await addSampleConfigurationToCart(page);
  await expect(cartRow).toBeVisible();

  await register(page, { name: 'E2E Accounts', email, password: 'correcthorse123' });

  // The guest cart's item must show up under the now-logged-in user - the
  // whole point of the merge - with exactly one row, not duplicated.
  await page.goto('/koszyk');
  await expect(cartRow).toBeVisible();
  await expect(cartRow).toHaveCount(1);

  // Logging out and back in must not lose it either - it's the user's
  // cart now, not tied to the guest cookie any more.
  await page.goto('/moje-konto');
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await login(page, { email, password: 'correcthorse123' });

  await page.goto('/koszyk');
  await expect(cartRow).toBeVisible();
});

test('an order placed while logged in shows up in order history', async ({ page }) => {
  /*
    A genuinely long journey, not a hang: register, configure a product, add
    it to the cart, complete checkout, then read the order back. Under four
    parallel workers on WebKit it repeatedly ran out of the 30s default at
    the *last* step, having already done all of the work - which carries no
    information beyond "the machine was busy", and an intermittently red
    suite is one people learn to ignore.

    `slow()` triples the budget rather than shortening what the test proves.
    Same remedy and same reasoning as `design-review-customer.spec.ts`.
    Recorded 2026-09-05 with ARCH-03, which moved the suite onto its own
    database but does nothing about four browsers sharing one Next server -
    that contention is what this is.
  */
  test.slow();

  const email = `e2e-accounts-order-${Date.now()}@example.test`;

  await register(page, { name: 'E2E Order History', email, password: 'correcthorse123' });
  await addSampleConfigurationToCart(page);

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');
  await fillReliably(page.getByLabel('E-mail'), email);
  await fillReliably(page.getByLabel('Telefon'), '+48123456789');
  await fillReliably(page.getByLabel('Imię'), 'E2E');
  await fillReliably(page.getByLabel('Nazwisko'), 'Order');
  await fillReliably(page.getByLabel('Ulica i numer'), 'Testowa 1');
  await fillReliably(page.getByLabel('Kod pocztowy'), '00-001');
  await fillReliably(page.getByLabel('Miejscowość'), 'Warszawa');
  await checkReliably(page.getByLabel('Akceptuję regulamin sklepu.'));
  await checkReliably(
    page.getByLabel('Przyjmuję do wiadomości, że produkty wykonywane na indywidualne', { exact: false }),
  );
  await page.getByRole('button', { name: 'Złóż zamówienie' }).click();
  await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible();

  await page.goto('/moje-konto/zamowienia');
  await expect(page.getByText('Nie masz jeszcze żadnych zamówień.')).not.toBeVisible();
});

import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

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

/**
 * `LoginForm`/`RegisterForm`/`CheckoutForm` are uncontrolled inputs
 * (`defaultValue`, no `value` - `CheckoutForm.tsx`'s own header explains
 * why: `useActionState` needs a real DOM remount to show echoed server
 * state, which a controlled input would fight). React reasserts an
 * uncontrolled input's SSR'd `defaultValue` once hydration finishes, which
 * silently discards anything typed into it BEFORE that finishes -
 * reproduced directly: `.fill()` immediately after `page.goto()` on
 * `/rejestracja` left the field empty, and the same race hit the checkout
 * form on mobile-safari (a fresh client-component mount, not a full page
 * navigation, is enough to trigger it there - WebKit's slower JS start
 * gives the race a wider window). Real visitors never hit this (hydration
 * is milliseconds on any real connection; a human doesn't start typing
 * before the page has visually settled).
 *
 * A fixed `waitForTimeout` before filling was tried first and was NOT
 * reliable - it passed locally but still flaked once under
 * `--repeat-each` on mobile-safari. `fillReliably` is the actually
 * deterministic fix: fill, read the value back, and retry the whole
 * fill-and-verify step until it genuinely sticks - no timing guess, and it
 * self-heals regardless of how long hydration happens to take on a given
 * run/machine/browser.
 */
async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    // Real key-by-key typing (dispatches genuine keyboard events over
    // time), not `.fill()` (an instant CDP value-set) - confirmed directly
    // that `.fill()` right after a fresh mount loses the race to React
    // reasserting the field's SSR'd `defaultValue`, while `pressSequentially`
    // at the same point does not, on every browser tried including
    // mobile-safari.
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 10 });
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

/** Same race as `fillReliably`, for a checkbox - verify-and-retry instead of a single `.check()`. */
async function checkReliably(locator: Locator): Promise<void> {
  await expect(async () => {
    await locator.check();
    await expect(locator).toBeChecked();
  }).toPass({ timeout: 5000 });
}

async function register(page: Page, params: { readonly name: string; readonly email: string; readonly password: string }) {
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
  const email = `e2e-accounts-${Date.now()}@example.test`;

  await addSampleConfigurationToCart(page);
  await expect(page.getByText('Obraz drewniany z grawerem')).toBeVisible();

  await register(page, { name: 'E2E Accounts', email, password: 'correcthorse123' });

  // The guest cart's item must show up under the now-logged-in user - the
  // whole point of the merge - with exactly one row, not duplicated.
  await page.goto('/koszyk');
  await expect(page.getByText('Obraz drewniany z grawerem')).toBeVisible();
  await expect(page.getByText('Obraz drewniany z grawerem')).toHaveCount(1);

  // Logging out and back in must not lose it either - it's the user's
  // cart now, not tied to the guest cookie any more.
  await page.goto('/moje-konto');
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await login(page, { email, password: 'correcthorse123' });

  await page.goto('/koszyk');
  await expect(page.getByText('Obraz drewniany z grawerem')).toBeVisible();
});

test('an order placed while logged in shows up in order history', async ({ page }) => {
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

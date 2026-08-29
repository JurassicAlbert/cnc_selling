import path from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * P4's real end-to-end path, checklist's own framing: "Custom upload:
 * upload → IP checkbox → warnings → order → status DESIGN_REVIEW". Same
 * click-through-by-visible-Polish-label style as `checkout.spec.ts`,
 * against the real seeded `wlasny-projekt-z-grawerem` product (`CUSTOM`
 * type — the one product with `CUSTOM_UPLOAD` as its first step, before
 * `MATERIAL`/`SIZE`, matching `domain/configuration/steps.ts`'s real
 * step order).
 *
 * Unlike `checkout.spec.ts`'s design (a pre-existing catalogue Design),
 * this product prices with `design: null` — base price + material +
 * finish only, no machining/design-surcharge component (P4's pricing
 * fix, `domain/pricing/calculate.ts`). This test's real value is proving
 * that whole chain end to end: a real uploaded file survives magic-byte
 * sniffing and storage, the resulting `CustomerDesign` id correctly
 * flows through cart and checkout (a real bug this session found and
 * fixed — `cart.ts`'s repository was hardcoding `customUploadId: null`
 * when reconstructing `Selections` from a stored `Configuration`), and
 * the order automatically lands in `DESIGN_REVIEW` — a gate that
 * existed since P5 but had never been exercised by a real
 * `CustomerDesign` until this pass.
 *
 * 2026-08-28: the configurator no longer gates one step at a time behind
 * "Dalej" (owner feedback — every section is a real, always-visible
 * swatch/field picker). Every field is filled/clicked directly now, no
 * "Dalej" clicks between them.
 *
 * 2026-08-29, owner feedback: "The price for the product should be clear,
 * no waiting for configure — we have price". MATERIAL/WYKOŃCZENIE/WYMIARY
 * now default to a real, already-feasible selection (the product's own
 * first material/finish and its middle `ProductPresetSize`) the instant the
 * page loads — no crumb click needed for any of them, even on this product.
 * The one real prerequisite left is CUSTOM_UPLOAD itself: this `CUSTOM`
 * -type product has no catalogue DESIGN, so pricing only becomes available
 * once a real file is uploaded (`selections.customUploadId` set) — it stays
 * a plain accordion band, unaffected by the breadcrumb redesign.
 */
test('uploads a custom design, completes checkout, and lands in DESIGN_REVIEW', async ({ page }) => {
  await page.goto('/produkt/wlasny-projekt-z-grawerem');

  const main = page.getByRole('main');

  // Twój projekt (CUSTOM_UPLOAD)
  const fileInput = main.locator('input[type="file"]');
  await fileInput.setInputFiles(path.resolve(process.cwd(), 'public/images/photos/gres.jpg'));
  await main.getByLabel('Akceptuję powyższe oświadczenie').check();
  await main.getByRole('button', { name: 'Prześlij projekt' }).click();
  await expect(main.getByText('Projekt został przesłany.')).toBeVisible();

  // Materiał/Wykończenie/Wymiary — already defaulted on load.

  // Podsumowanie — the honest "this is an estimate" notice (P4).
  await expect(
    main.getByText('Podana cena to wstępny szacunek', { exact: false }),
  ).toBeVisible();
  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();

  await expect(page).toHaveURL('/koszyk');
  await expect(page.getByText('Własny projekt z grawerem')).toBeVisible();

  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');
  // The real bug this test guards: a stale cart-repository mapping used
  // to drop the uploaded design when re-pricing at checkout, which
  // surfaced as exactly this message.
  await expect(page.getByText('Cena tej konfiguracji uległa zmianie')).not.toBeVisible();

  await page.getByLabel('E-mail').fill('e2e-custom-upload@example.com');
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
});

// This spec now reads the uploaded file's id straight from Postgres, so it
// needs `.env` the way `admin-authz.spec.ts` does - the Playwright runner
// process is not the app.
import 'dotenv/config';

import path from 'node:path';

// Not `@playwright/test`: this spec uploads, and SEC-08 added a per-IP upload
// limit on 2026-09-08. A per-session limit could never bite here (each test
// gets a fresh cookie jar); a per-IP one accumulates across every run on this
// machine, so without the fixture's reset the suite would start refusing
// uploads after enough runs in an hour - silently, the way SEC-01's
// registration limit did. See `fixtures.ts` and `rate-limit-reset.ts`.
import { expect, test } from './fixtures';

import { prisma } from '../../src/server/db/client';

/**
 * P4's real end-to-end path, checklist's own framing: "Custom upload:
 * upload → IP checkbox → warnings → order → status DESIGN_REVIEW". Same
 * click-through-by-visible-Polish-label style as `checkout.spec.ts`,
 * against the real seeded `wlasny-projekt-z-grawerem` product (`CUSTOM`
 * type - the one product with `CUSTOM_UPLOAD` as its first step, before
 * `MATERIAL`/`SIZE`, matching `domain/configuration/steps.ts`'s real
 * step order).
 *
 * Unlike `checkout.spec.ts`'s design (a pre-existing catalogue Design),
 * this product prices with `design: null` - base price + material +
 * finish only, no machining/design-surcharge component (P4's pricing
 * fix, `domain/pricing/calculate.ts`). This test's real value is proving
 * that whole chain end to end: a real uploaded file survives magic-byte
 * sniffing and storage, the resulting `CustomerDesign` id correctly
 * flows through cart and checkout (a real bug this session found and
 * fixed - `cart.ts`'s repository was hardcoding `customUploadId: null`
 * when reconstructing `Selections` from a stored `Configuration`), and
 * the order automatically lands in `DESIGN_REVIEW` - a gate that
 * existed since P5 but had never been exercised by a real
 * `CustomerDesign` until this pass.
 *
 * 2026-08-28: the configurator no longer gates one step at a time behind
 * "Dalej" (owner feedback - every section is a real, always-visible
 * swatch/field picker). Every field is filled/clicked directly now, no
 * "Dalej" clicks between them.
 *
 * 2026-08-29, owner feedback: "The price for the product should be clear,
 * no waiting for configure - we have price". MATERIAL/WYKOŃCZENIE/WYMIARY
 * now default to a real, already-feasible selection (the product's own
 * first material/finish and its middle `ProductPresetSize`) the instant the
 * page loads - no crumb click needed for any of them, even on this product.
 * The one real prerequisite left is CUSTOM_UPLOAD itself: this `CUSTOM`
 * -type product has no catalogue DESIGN, so pricing only becomes available
 * once a real file is uploaded (`selections.customUploadId` set) - it stays
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
  // The band's collapsed-header label, not the "Projekt został przesłany."
  // alert inside it. A successful upload sets `selections.customUploadId`,
  // which advances the accordion - so the alert is rendered and then hidden
  // by the very success it announces, and asserting on it is a race the
  // suite lost on 2026-09-04 ("locator resolved to ... unexpected value
  // hidden"). This label is the durable consequence: it is on screen for as
  // long as a file is attached.
  await expect(main.getByText('Plik przesłany')).toBeVisible();

  // Materiał/Wykończenie/Wymiary - already defaulted on load.

  // Podsumowanie - the honest "this is an estimate" notice (P4).
  await expect(
    main.getByText('Podana cena to wstępny szacunek', { exact: false }),
  ).toBeVisible();
  const addToCartButton = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCartButton).toBeEnabled();
  await addToCartButton.click();

  await expect(page).toHaveURL('/koszyk');
  // The cart row's own heading, not any text on the page: a bare `getByText`
  // also matches Next's route announcer (`__next-route-announcer__`), which
  // holds the page title for a moment after each navigation. A strict-mode
  // violation that only fires inside that window, so it reads as a browser
  // flake (2026-09-04).
  await expect(page.getByRole('heading', { name: 'Własny projekt z grawerem' })).toBeVisible();

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

  /*
    SEC-09, on the file this test has just genuinely uploaded.

    `/api/plik/[fileId]` stopped reading whole files into memory and now hands
    the response a `ReadableStream` from the storage adapter. Every page that
    shows an uploaded design does it through an `<img>`, and a broken `<img>`
    is invisible to a test that only looks at headings - so the bytes are
    fetched here and counted. A streamed body that arrives short, or a
    `Content-Length` that disagrees with what actually arrives, is exactly the
    failure this change could introduce and nothing else would catch.

    Fetched from the page's own context, so it carries the session cookie the
    route authorises against.
  */
  /*
    Scoped to THIS browser's guest session, not "the newest design in the
    database" - which is what the first version asked for, and it failed on
    desktop-chromium while passing on mobile-safari. The two projects run in
    parallel against one database, so the newest row was usually the other
    project's, and the route refused it with a 404. Exactly right of the
    route, and a test that reads another session's data would have been
    wrong even on the runs where it happened to pass.
  */
  const cookies = await page.context().cookies();
  const guestSession = cookies.find((cookie) => cookie.name === 'gsid')?.value;
  expect(guestSession).toBeTruthy();
  const design = await prisma.customerDesign.findFirstOrThrow({
    where: { sessionToken: guestSession },
    orderBy: { createdAt: 'desc' },
    select: { fileId: true },
  });

  const served = await page.evaluate(async (fileId) => {
    const response = await fetch(`/api/plik/${fileId}`);
    const body = await response.arrayBuffer();
    return {
      status: response.status,
      contentLength: response.headers.get('content-length'),
      nosniff: response.headers.get('x-content-type-options'),
      received: body.byteLength,
    };
  }, design.fileId);

  expect(served.status).toBe(200);
  expect(served.received).toBeGreaterThan(0);
  expect(served.contentLength).toBe(String(served.received));
  expect(served.nosniff).toBe('nosniff');
});

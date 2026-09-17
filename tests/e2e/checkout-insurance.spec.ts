import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';
import { addToCart } from './add-to-cart';

/**
 * INSURANCE-01, the customer journey.
 *
 * **This test has to create its own rate card, and that is the feature, not a
 * gap in the seed.** The owner chose the carrier's real declared-value table
 * over a flat fee or a percentage; neither InPost nor DPD publishes one
 * citably, so seeding a plausible band would be inventing a number a customer
 * would be asked to rely on. Every method therefore ships with an empty table
 * and offers nothing at all - `docs/OPEN_ITEMS.md` §10.
 *
 * So the run is: no cover is offered, add a band, cover is offered, buy it,
 * and it is on the order. The first assertion is worth as much as the rest -
 * it is the guarantee that today's storefront shows a customer nothing.
 *
 * The band goes on **every** active method rather than on a new one, because
 * the checkout selects the first feasible method itself and a method added
 * here would not be it. Harmless to anything running alongside: the option is
 * opt-in and nothing else ticks it.
 */

const BAND_LABEL = 'e2e do 5000 zł';
const BAND_PRICE_GROSZE = 900;

async function addBandToEveryActiveMethod(): Promise<void> {
  const methods = await prisma.deliveryMethod.findMany({ where: { isActive: true }, select: { id: true } });
  await prisma.deliveryInsuranceTier.createMany({
    data: methods.map((method) => ({
      deliveryMethodId: method.id,
      labelPl: BAND_LABEL,
      // High enough to cover any cart this test can build, so the assertion
      // is about the mechanism rather than about where the band happens to
      // stop.
      maxValueGrosze: 500_000,
      priceGrosze: BAND_PRICE_GROSZE,
      sortOrder: 500_000,
    })),
  });
}

test('a customer can buy the carrier cover, and only once it exists', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  await addToCart(page);

  await expect(page).toHaveURL('/koszyk');
  await page.getByRole('link', { name: 'Przejdź do zamówienia' }).click();
  await expect(page).toHaveURL('/koszyk/zamowienie');

  // Nothing offered, because no carrier has a table yet. This is the state of
  // the live storefront.
  await expect(page.getByLabel('Ubezpieczenie przesyłki')).toHaveCount(0);

  try {
    await addBandToEveryActiveMethod();
    // The action revalidates this path, but this test wrote to the database
    // behind its back, so the page has to be asked again.
    await page.reload();

    const insurance = page.getByLabel('Ubezpieczenie przesyłki');
    await expect(insurance).toBeVisible();
    // The band's own name, as an admin typed it - the customer has to be able
    // to see what they are covered for, not just what it costs.
    await expect(page.getByText(BAND_LABEL)).toBeVisible();

    await insurance.check();

    await page.getByLabel('E-mail').fill('e2e-insurance@example.com');
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

    // On the document the customer keeps.
    await expect(page.getByText('Ubezpieczenie')).toBeVisible();

    /*
      And on the order itself, which is the assertion that matters: the
      premium is a snapshot the customer owes, re-derived server-side from
      the carrier's table rather than taken from the form. Checked against
      the row rather than against rendered text so the arithmetic is pinned,
      not the formatting.
    */
    const order = await prisma.order.findFirstOrThrow({
      where: { email: 'e2e-insurance@example.com' },
      orderBy: { createdAt: 'desc' },
      select: {
        insuranceGrosze: true,
        insuranceLabelPl: true,
        subtotalNetGrosze: true,
        vatGrosze: true,
        shippingGrosze: true,
        totalGrossGrosze: true,
      },
    });
    expect(order.insuranceGrosze).toBe(BAND_PRICE_GROSZE);
    expect(order.insuranceLabelPl).toBe(BAND_LABEL);
    expect(order.totalGrossGrosze).toBe(
      order.subtotalNetGrosze + order.vatGrosze + order.shippingGrosze + BAND_PRICE_GROSZE,
    );
  } finally {
    // In a `finally` because a failure part-way through must not leave a rate
    // card behind: the next run's first assertion is "nothing is offered",
    // and a leftover band would fail it for the wrong reason.
    await prisma.deliveryInsuranceTier.deleteMany({ where: { labelPl: BAND_LABEL } });
  }
});

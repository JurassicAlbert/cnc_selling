import { afterEach, describe, expect, it } from 'vitest';

import { resolveDeliveryMethodsForCart } from '@/server/repositories/delivery-methods';
import type { CartItemView } from '@/server/repositories/cart';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-delivery-methods-';

async function seedMethod(overrides: {
  readonly namePl?: string;
  readonly priceGrosze?: number;
  readonly freeShippingThresholdGrosze?: number | null;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
  readonly requiresPickupPoint?: boolean;
  readonly weightTiers?: readonly {
    readonly labelPl: string;
    readonly maxWeightGrams: number;
    readonly priceGrosze: number;
    readonly maxWidthMm?: number;
    readonly maxHeightMm?: number;
    readonly maxDepthMm?: number;
  }[];
  readonly insuranceTiers?: readonly {
    readonly labelPl: string;
    readonly maxValueGrosze: number;
    readonly priceGrosze: number;
  }[];
}) {
  return prisma.deliveryMethod.create({
    data: {
      namePl: overrides.namePl ?? `${PREFIX}metoda`,
      descPl: 'Opis testowej metody.',
      priceGrosze: overrides.priceGrosze ?? 1_500,
      freeShippingThresholdGrosze: overrides.freeShippingThresholdGrosze ?? null,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      isActive: overrides.isActive ?? true,
      sortOrder: overrides.sortOrder ?? 0,
      requiresPickupPoint: overrides.requiresPickupPoint ?? false,
      weightTiers: overrides.weightTiers === undefined ? undefined : { create: [...overrides.weightTiers] },
      insuranceTiers: overrides.insuranceTiers === undefined ? undefined : { create: [...overrides.insuranceTiers] },
    },
  });
}

function cartItem(overrides: Partial<CartItemView> = {}): CartItemView {
  return {
    cartItemId: 'x',
    configurationId: 'x',
    quantity: 1,
    productSlug: 'x',
    productNamePl: 'x',
    imageUrl: null,
    designNamePl: null,
    materialNamePl: null,
    finishNamePl: null,
    fontNamePl: null,
    widthMm: 500,
    heightMm: 400,
    thicknessMm: 20,
    materialDensityKgPerM3: 750,
    personalizationText: null,
    isComplete: true,
    priceGrossGrosze: 10_000,
    priceBreakdown: null,
    moduleLayout: null,
    warnings: [],
    acknowledgedWarnings: [],
    selections: {
      designId: null,
      customUploadId: null,
      materialId: null,
      widthMm: 500,
      heightMm: 400,
      thicknessMm: 20,
      finishId: null,
      installationVariant: null,
      personalizationText: null,
      fontId: null,
    },
    designCode: null,
    pricingVersion: 1,
    customDesignId: null,
    customDesignStatus: null,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.order.deleteMany({ where: { deliveryMethod: { namePl: { startsWith: PREFIX } } } });
  await prisma.deliveryWeightTier.deleteMany({ where: { deliveryMethod: { namePl: { startsWith: PREFIX } } } });
  await prisma.deliveryInsuranceTier.deleteMany({ where: { deliveryMethod: { namePl: { startsWith: PREFIX } } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('resolveDeliveryMethodsForCart', () => {
  it('returns only active methods, ordered by sortOrder', async () => {
    await seedMethod({ namePl: `${PREFIX}nieaktywna`, isActive: false, sortOrder: 0 });
    const second = await seedMethod({ namePl: `${PREFIX}druga`, sortOrder: 2 });
    const first = await seedMethod({ namePl: `${PREFIX}pierwsza`, sortOrder: 1 });

    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 10_000, items: [cartItem()] });
    const ids = result.map((m) => m.id);

    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
    expect(result.some((m) => m.namePl === `${PREFIX}nieaktywna`)).toBe(false);
  });

  it('surfaces requiresPickupPoint', async () => {
    const withPoint = await seedMethod({ namePl: `${PREFIX}paczkomat`, requiresPickupPoint: true });
    const withoutPoint = await seedMethod({ namePl: `${PREFIX}kurier`, requiresPickupPoint: false });

    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 10_000, items: [cartItem()] });

    expect(result.find((m) => m.id === withPoint.id)?.requiresPickupPoint).toBe(true);
    expect(result.find((m) => m.id === withoutPoint.id)?.requiresPickupPoint).toBe(false);
  });

  it('computes a real weight-tier price from the real cart, not the flat rate', async () => {
    const method = await seedMethod({
      namePl: `${PREFIX}wagowa`,
      priceGrosze: 1_500,
      weightTiers: [
        { labelPl: 'do 1 kg', maxWeightGrams: 1_000, priceGrosze: 1_649 },
        { labelPl: 'do 5 kg', maxWeightGrams: 5_000, priceGrosze: 1_849 },
      ],
    });

    // 0.5*0.4*0.02*750*1000 = 3000g → the "do 5 kg" tier, not the flat 1500
    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 10_000, items: [cartItem()] });
    const resolved = result.find((m) => m.id === method.id);

    expect(resolved?.feasible).toBe(true);
    expect(resolved?.priceGrosze).toBe(1_849);
    expect(resolved?.matchedTierLabelPl).toBe('do 5 kg');
  });

  it('marks a method infeasible when the cart exceeds its real weight tiers', async () => {
    const method = await seedMethod({
      namePl: `${PREFIX}lekka`,
      weightTiers: [{ labelPl: 'do 1 kg', maxWeightGrams: 1_000, priceGrosze: 1_000 }],
    });

    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 10_000, items: [cartItem()] }); // 3000g cart
    const resolved = result.find((m) => m.id === method.id);

    expect(resolved?.feasible).toBe(false);
    expect(resolved?.infeasibleReasonPl).not.toBeNull();
  });

  it('marks a locker-based method infeasible for a real oversized item', async () => {
    const method = await seedMethod({
      namePl: `${PREFIX}paczkomat-c`,
      weightTiers: [{ labelPl: 'C', maxWeightGrams: 25_000, priceGrosze: 2_049, maxWidthMm: 380, maxHeightMm: 640, maxDepthMm: 410 }],
    });

    const oversized = cartItem({ widthMm: 700, heightMm: 500, thicknessMm: 12 });
    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 10_000, items: [oversized] });
    const resolved = result.find((m) => m.id === method.id);

    expect(resolved?.feasible).toBe(false);
  });

  it('applies the free-shipping threshold on top of weight tiers', async () => {
    const method = await seedMethod({
      namePl: `${PREFIX}prog`,
      freeShippingThresholdGrosze: 5_000,
      weightTiers: [{ labelPl: 'do 5 kg', maxWeightGrams: 5_000, priceGrosze: 1_849 }],
    });

    const result = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze: 5_000, items: [cartItem()] });
    const resolved = result.find((m) => m.id === method.id);

    expect(resolved?.feasible).toBe(true);
    expect(resolved?.priceGrosze).toBe(0);
  });
});

/**
 * INSURANCE-01. The offer a customer is shown has to be decided in the same
 * place the delivery price is, because `createOrder` re-derives both from
 * this one function and must never disagree with the picker that produced the
 * submission.
 *
 * The bands themselves are the carrier's own declared-value table, entered at
 * `/panel/dostawa`. None is seeded, so no method offers insurance today - that
 * is `docs/OPEN_ITEMS.md` §10 and the owner's "you are not allowed to lie",
 * not an oversight. These tests supply their own.
 */
/**
 * The resolver returns EVERY active method, and other files create methods in
 * parallel against the same database, so the one this test seeded has to be
 * picked out by id. Taking `[0]` is how these four tests were first written
 * and it failed once in three full runs - the same lesson the tests above
 * already encode with `result.find(...)`.
 */
async function resolveOne(id: string, subtotalGrossGrosze: number) {
  const all = await resolveDeliveryMethodsForCart({ subtotalGrossGrosze, items: [cartItem()] });
  return all.find((method) => method.id === id) ?? null;
}

describe('resolveDeliveryMethodsForCart - insurance', () => {
  it('offers nothing when the carrier has no declared-value table', async () => {
    const seeded = await seedMethod({ namePl: `${PREFIX}bez-ubezpieczenia` });

    const method = await resolveOne(seeded.id, 20_000);

    expect(method?.insurance).toBeNull();
  });

  it('offers the cheapest band that actually covers the order', async () => {
    const seeded = await seedMethod({
      namePl: `${PREFIX}z-ubezpieczeniem`,
      // Deliberately out of order: a rate card typed in as it is read must
      // still band a cart correctly.
      insuranceTiers: [
        { labelPl: 'do 5000 zł', maxValueGrosze: 500_000, priceGrosze: 900 },
        { labelPl: 'do 1000 zł', maxValueGrosze: 100_000, priceGrosze: 300 },
        { labelPl: 'do 2500 zł', maxValueGrosze: 250_000, priceGrosze: 500 },
      ],
    });

    const method = await resolveOne(seeded.id, 150_000);

    expect(method?.insurance).toEqual({ labelPl: 'do 2500 zł', priceGrosze: 500 });
  });

  it('offers nothing for an order worth more than the table covers', async () => {
    const seeded = await seedMethod({
      namePl: `${PREFIX}poza-tabela`,
      insuranceTiers: [{ labelPl: 'do 1000 zł', maxValueGrosze: 100_000, priceGrosze: 300 }],
    });

    // The band that exists would be a lie here: "do 1000 zł" cover on a
    // 2000 zł order leaves the customer believing they are covered when they
    // are not. Hidden rather than sold.
    const method = await resolveOne(seeded.id, 200_000);

    expect(method?.insurance).toBeNull();
  });

  it('bands on the value of the goods, exactly at the boundary', async () => {
    const seeded = await seedMethod({
      namePl: `${PREFIX}granica`,
      insuranceTiers: [
        { labelPl: 'do 1000 zł', maxValueGrosze: 100_000, priceGrosze: 300 },
        { labelPl: 'do 2500 zł', maxValueGrosze: 250_000, priceGrosze: 500 },
      ],
    });

    // Inclusive: `maxValueGrosze` is "the highest order value this band
    // covers", so an order worth exactly that is in it.
    const method = await resolveOne(seeded.id, 100_000);

    expect(method?.insurance).toEqual({ labelPl: 'do 1000 zł', priceGrosze: 300 });
  });
});

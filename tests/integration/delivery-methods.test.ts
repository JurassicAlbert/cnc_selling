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

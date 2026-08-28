import { afterEach, describe, expect, it } from 'vitest';

import { computeShippingGrosze } from '@/domain/checkout/delivery';
import { listActiveDeliveryMethods } from '@/server/repositories/delivery-methods';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-delivery-methods-';

async function seedMethod(overrides: {
  readonly namePl?: string;
  readonly priceGrosze?: number;
  readonly freeShippingThresholdGrosze?: number | null;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
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
    },
  });
}

afterEach(async () => {
  await prisma.order.deleteMany({ where: { deliveryMethod: { namePl: { startsWith: PREFIX } } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('computeShippingGrosze', () => {
  it('charges the full price when there is no free-shipping threshold', () => {
    expect(computeShippingGrosze({ priceGrosze: 1_500, freeShippingThresholdGrosze: null }, 0)).toBe(1_500);
    expect(computeShippingGrosze({ priceGrosze: 1_500, freeShippingThresholdGrosze: null }, 1_000_000)).toBe(1_500);
  });

  it('charges the full price when the subtotal is below the threshold', () => {
    expect(computeShippingGrosze({ priceGrosze: 1_500, freeShippingThresholdGrosze: 30_000 }, 29_999)).toBe(1_500);
  });

  it('is free once the subtotal meets or exceeds the threshold', () => {
    expect(computeShippingGrosze({ priceGrosze: 1_500, freeShippingThresholdGrosze: 30_000 }, 30_000)).toBe(0);
    expect(computeShippingGrosze({ priceGrosze: 1_500, freeShippingThresholdGrosze: 30_000 }, 50_000)).toBe(0);
  });
});

describe('listActiveDeliveryMethods', () => {
  it('returns only active methods, ordered by sortOrder', async () => {
    await seedMethod({ namePl: `${PREFIX}nieaktywna`, isActive: false, sortOrder: 0 });
    const second = await seedMethod({ namePl: `${PREFIX}druga`, sortOrder: 2 });
    const first = await seedMethod({ namePl: `${PREFIX}pierwsza`, sortOrder: 1 });

    const result = await listActiveDeliveryMethods();
    const ids = result.map((m) => m.id);

    expect(ids).not.toContain(undefined);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
    expect(result.some((m) => m.namePl === `${PREFIX}nieaktywna`)).toBe(false);
  });
});

import { prisma } from '@/server/db/client';

/**
 * Public `DeliveryMethod` reads — P9 phase 5. Replaces the single
 * hardcoded `StoreSettings.shippingFlatRateGrosze` at checkout: every
 * active method is real, admin-managed, and its price is always
 * recomputed server-side from this table, never trusted from the client.
 *
 * `computeShippingGrosze` itself lives in `domain/checkout/delivery.ts`,
 * not here — that file's `prisma` import (and the real `pg` driver behind
 * it) is unsafe to pull into a `'use client'` component. `CheckoutForm.tsx`
 * imports the pure function straight from the domain module for its live
 * estimate; `type ActiveDeliveryMethod` below is still fine to import from
 * here into a client component (a type-only import is fully erased, never
 * reaching the browser bundle).
 */

export type ActiveDeliveryMethod = {
  readonly id: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly priceGrosze: number;
  readonly freeShippingThresholdGrosze: number | null;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly trackingAvailable: boolean;
};

export async function listActiveDeliveryMethods(): Promise<readonly ActiveDeliveryMethod[]> {
  return prisma.deliveryMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      namePl: true,
      descPl: true,
      priceGrosze: true,
      freeShippingThresholdGrosze: true,
      estimatedDaysMin: true,
      estimatedDaysMax: true,
      trackingAvailable: true,
    },
  });
}

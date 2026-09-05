import { prisma } from '@/server/db/client';
import { evaluateDeliveryMethod } from '@/domain/checkout/delivery';
import type { DeliveryPriceInfo } from '@/domain/checkout/delivery';
import type { CartWeightItem } from '@/domain/shipping/weight';
import type { CartItemView } from '@/server/repositories/cart';

/**
 * Public `DeliveryMethod` reads - P9 phase 5. Replaces the single
 * hardcoded `StoreSettings.shippingFlatRateGrosze` at checkout: every
 * active method is real, admin-managed, and its price is always
 * recomputed server-side from this table, never trusted from the client.
 *
 * 2026-08-29 rewrite: a method's price is no longer a flat rate the
 * client can compute from the subtotal alone - it depends on the real
 * cart's real weight (and, for a locker method, whether every item
 * physically fits), so `ActiveDeliveryMethod` now carries the ALREADY
 * evaluated `priceGrosze`/`feasible`/`infeasibleReasonPl` for one specific
 * cart, not a static row. `resolveDeliveryMethodsForCart` is the one
 * place that does this - `type` here is still fine to import into a
 * client component (type-only, fully erased); the resolver function
 * itself imports `prisma` and must never cross that boundary.
 */

export type ActiveDeliveryMethod = {
  readonly id: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly priceGrosze: number;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly trackingAvailable: boolean;
  readonly requiresPickupPoint: boolean;
  /** The real carrier this method's pickup points belong to (`server/delivery/pickup-points.ts` is carrier-scoped) - `null` for a method with no pickup-point step. */
  readonly carrier: string | null;
  readonly feasible: boolean;
  readonly infeasibleReasonPl: string | null;
  readonly matchedTierLabelPl: string | null;
  /**
   * UX-07. True only when the cart crossed this method's free-shipping
   * threshold - not merely when the price is zero. `Odbiór osobisty` is free
   * because nothing is shipped, and telling a customer their order
   * "qualifies for free delivery" of a collection they are driving to
   * themselves is a sentence about nothing.
   */
  readonly freeShippingApplied: boolean;
};

function toCartWeightItems(items: readonly CartItemView[]): readonly CartWeightItem[] {
  return items.map((item) => ({
    widthMm: item.widthMm,
    heightMm: item.heightMm,
    thicknessMm: item.thicknessMm,
    materialDensityKgPerM3: item.materialDensityKgPerM3,
    quantity: item.quantity,
  }));
}

function infeasibleReasonMessage(reason: 'TOO_HEAVY' | 'ITEM_TOO_LARGE'): string {
  switch (reason) {
    case 'TOO_HEAVY':
      return 'Niedostępne - zamówienie przekracza maksymalną wagę obsługiwaną przez tę metodę.';
    case 'ITEM_TOO_LARGE':
      return 'Niedostępne - jeden z produktów w koszyku jest za duży dla tej metody dostawy.';
  }
}

/**
 * Real per-cart evaluation of every active `DeliveryMethod` - the one
 * function both `koszyk/zamowienie` (to render the picker) and
 * `createOrder` (to re-validate the chosen one, never trusting the
 * client) call, so the two can never silently disagree.
 */
export async function resolveDeliveryMethodsForCart(cart: {
  readonly subtotalGrossGrosze: number;
  readonly items: readonly CartItemView[];
}): Promise<readonly ActiveDeliveryMethod[]> {
  const methods = await prisma.deliveryMethod.findMany({
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
      requiresPickupPoint: true,
      carrier: true,
      weightTiers: {
        orderBy: { sortOrder: 'asc' },
        select: { labelPl: true, maxWeightGrams: true, priceGrosze: true, maxWidthMm: true, maxHeightMm: true, maxDepthMm: true },
      },
    },
  });

  const weightItems = toCartWeightItems(cart.items);

  return methods.map((method) => {
    const priceInfo: DeliveryPriceInfo = {
      priceGrosze: method.priceGrosze,
      freeShippingThresholdGrosze: method.freeShippingThresholdGrosze,
      weightTiers: method.weightTiers,
    };
    const evaluation = evaluateDeliveryMethod(priceInfo, { subtotalGrossGrosze: cart.subtotalGrossGrosze, items: weightItems });

    return {
      id: method.id,
      namePl: method.namePl,
      descPl: method.descPl,
      priceGrosze: evaluation.feasible ? evaluation.priceGrosze : method.priceGrosze,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
      trackingAvailable: method.trackingAvailable,
      requiresPickupPoint: method.requiresPickupPoint,
      carrier: method.carrier,
      feasible: evaluation.feasible,
      infeasibleReasonPl: evaluation.feasible ? null : infeasibleReasonMessage(evaluation.reason),
      matchedTierLabelPl: evaluation.feasible ? evaluation.matchedTierLabelPl : null,
      freeShippingApplied: evaluation.feasible && evaluation.freeShippingApplied,
    };
  });
}

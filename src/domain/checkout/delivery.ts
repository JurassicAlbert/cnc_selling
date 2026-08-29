/**
 * Pure delivery-pricing logic — deliberately NOT in `src/server/repositories`
 * (which imports the real `pg`/Prisma client, unsafe to pull into a
 * `'use client'` component: doing that once broke the production build with
 * `Module not found: Can't resolve 'net'/'tls'/'util'`, the Postgres driver's
 * Node-only dependencies leaking into the browser bundle).
 *
 * 2026-08-29 rewrite, owner request: shipping price is no longer a single
 * flat rate — it's picked from the chosen method's own real weight-tier
 * table (`DeliveryWeightTier`, sourced from each carrier's own published
 * price list — see `prisma/seed.ts`). A method's price is now fully
 * determined by the CART (its total real weight — `domain/shipping/weight.ts`
 * — and, for a locker-based method, whether every item physically fits),
 * not something the customer's own selection changes — so unlike the old
 * version, this is now computed ONCE, server-side, in
 * `server/repositories/delivery-methods.ts`'s `resolveDeliveryMethodsForCart`
 * — `CheckoutForm.tsx` just displays the result, it no longer imports or
 * calls anything from this file directly.
 */

import { computeCartWeightGrams, fitsLockerOpening } from '@/domain/shipping/weight';
import type { CartWeightItem } from '@/domain/shipping/weight';

export type WeightTierInfo = {
  readonly labelPl: string;
  readonly maxWeightGrams: number;
  readonly priceGrosze: number;
  readonly maxWidthMm: number | null;
  readonly maxHeightMm: number | null;
  readonly maxDepthMm: number | null;
};

export type DeliveryPriceInfo = {
  readonly priceGrosze: number;
  readonly freeShippingThresholdGrosze: number | null;
  readonly weightTiers: readonly WeightTierInfo[];
};

export type DeliveryEvaluation =
  | { readonly feasible: true; readonly priceGrosze: number; readonly matchedTierLabelPl: string | null }
  | { readonly feasible: false; readonly reason: 'TOO_HEAVY' | 'ITEM_TOO_LARGE' };

/**
 * The one real computation: given a method's own real price data, a cart's
 * real subtotal (for the free-shipping override) and real physical profile
 * (weight + per-item dimensions, for a locker-fit check), decide whether
 * this method is even usable for this cart and, if so, what it costs.
 *
 * Order of checks, deliberately: free-shipping threshold first (a merchant
 * policy override that should win regardless of weight), then — for a
 * method with no real tier table at all (`Odbiór osobisty`, or a carrier
 * row prepared but not yet priced) — the flat `priceGrosze` fallback, then
 * real per-item locker-fit (only meaningful for a tier that actually
 * carries dimension limits), then the cheapest tier whose weight ceiling
 * the cart's real total weight clears.
 */
export function evaluateDeliveryMethod(
  method: DeliveryPriceInfo,
  cart: { readonly subtotalGrossGrosze: number; readonly items: readonly CartWeightItem[] },
): DeliveryEvaluation {
  if (method.freeShippingThresholdGrosze !== null && cart.subtotalGrossGrosze >= method.freeShippingThresholdGrosze) {
    return { feasible: true, priceGrosze: 0, matchedTierLabelPl: null };
  }
  if (method.weightTiers.length === 0) {
    return { feasible: true, priceGrosze: method.priceGrosze, matchedTierLabelPl: null };
  }

  const cartWeightGrams = computeCartWeightGrams(cart.items);

  // Real InPost Paczkomat sizes aren't just weight brackets with a shared
  // shape — XS is a genuinely SMALLER opening than A/B/C, not just
  // shallower — so each tier's own weight ceiling AND its own dimensions
  // (when it has any) are checked TOGETHER, per tier, cheapest first. A
  // tier with no dimension data (a courier with no published size limit)
  // only ever gates on weight.
  const sortedByPrice = [...method.weightTiers].sort((a, b) => a.priceGrosze - b.priceGrosze);

  let sawWeightCapacityWithoutFit = false;
  for (const tier of sortedByPrice) {
    if (cartWeightGrams > tier.maxWeightGrams) {
      continue;
    }
    if (tier.maxWidthMm === null || tier.maxHeightMm === null || tier.maxDepthMm === null) {
      return { feasible: true, priceGrosze: tier.priceGrosze, matchedTierLabelPl: tier.labelPl };
    }
    const opening = { openingWidthMm: tier.maxWidthMm, openingHeightMm: tier.maxHeightMm, maxDepthMm: tier.maxDepthMm };
    const everyItemFits = cart.items.every((item) => {
      if (item.widthMm === null || item.heightMm === null) {
        return true; // nothing real to check against — never block on missing data
      }
      const thicknessMm = item.thicknessMm ?? 18;
      return fitsLockerOpening({ widthMm: item.widthMm, heightMm: item.heightMm, thicknessMm }, opening);
    });
    if (everyItemFits) {
      return { feasible: true, priceGrosze: tier.priceGrosze, matchedTierLabelPl: tier.labelPl };
    }
    sawWeightCapacityWithoutFit = true;
  }

  // Nothing matched. If at least one tier had enough weight capacity but
  // rejected on size, that's the more specific, more useful reason to
  // surface than a generic weight ceiling.
  return { feasible: false, reason: sawWeightCapacityWithoutFit ? 'ITEM_TOO_LARGE' : 'TOO_HEAVY' };
}

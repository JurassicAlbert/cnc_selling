/**
 * Pure delivery-pricing logic - deliberately NOT in `src/server/repositories`
 * (which imports the real `pg`/Prisma client, unsafe to pull into a
 * `'use client'` component: doing that once broke the production build with
 * `Module not found: Can't resolve 'net'/'tls'/'util'`, the Postgres driver's
 * Node-only dependencies leaking into the browser bundle).
 *
 * 2026-08-29 rewrite, owner request: shipping price is no longer a single
 * flat rate - it's picked from the chosen method's own real weight-tier
 * table (`DeliveryWeightTier`, sourced from each carrier's own published
 * price list - see `prisma/seed.ts`). A method's price is now fully
 * determined by the CART (its total real weight - `domain/shipping/weight.ts`
 * - and, for a locker-based method, whether every item physically fits),
 * not something the customer's own selection changes - so unlike the old
 * version, this is now computed ONCE, server-side, in
 * `server/repositories/delivery-methods.ts`'s `resolveDeliveryMethodsForCart`
 * - `CheckoutForm.tsx` just displays the result, it no longer imports or
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
  | {
      readonly feasible: true;
      readonly priceGrosze: number;
      readonly matchedTierLabelPl: string | null;
      /**
       * UX-07. True only when this costs nothing *because the cart crossed
       * the free-shipping threshold* - not merely because the price is zero.
       *
       * Two different zeroes were being reported as one. A cart that crosses
       * the threshold has earned free delivery and saying so is worth doing;
       * `Odbiór osobisty` is zero because nothing is being shipped at all, so
       * „Twoje zamówienie kwalifikuje się do darmowej wysyłki" is simply
       * untrue of it - it costs nothing at 10 zł and nothing at 10 000 zł.
       */
      readonly freeShippingApplied: boolean;
    }
  | { readonly feasible: false; readonly reason: 'TOO_HEAVY' | 'ITEM_TOO_LARGE' };

/**
 * The one real computation: given a method's own real price data, a cart's
 * real subtotal (for the free-shipping override) and real physical profile
 * (weight + per-item dimensions, for a locker-fit check), decide whether
 * this method is even usable for this cart and, if so, what it costs.
 *
 * Order of checks, deliberately: free-shipping threshold first (a merchant
 * policy override that should win regardless of weight), then - for a
 * method with no real tier table at all (`Odbiór osobisty`, or a carrier
 * row prepared but not yet priced) - the flat `priceGrosze` fallback, then
 * real per-item locker-fit (only meaningful for a tier that actually
 * carries dimension limits), then the cheapest tier whose weight ceiling
 * the cart's real total weight clears.
 */
export function evaluateDeliveryMethod(
  method: DeliveryPriceInfo,
  cart: { readonly subtotalGrossGrosze: number; readonly items: readonly CartWeightItem[] },
): DeliveryEvaluation {
  const carriage = resolveCarriage(method, cart);
  if (!carriage.feasible) {
    return carriage;
  }

  /*
    Feasibility is physical; the threshold is commercial. `resolveCarriage`
    above has already decided whether this carrier will take this parcel at
    all, and only then does the shop decide what to charge for it.

    That ordering is the fix, not decoration. This used to test the
    threshold **first** and return immediately, so a cart over it was handed
    a locker method at 0,00 zł with the locker never measured - while the
    same physical parcel one grosz below the threshold was correctly refused
    as ITEM_TOO_LARGE. No discount makes a 30 kg parcel fit a 25 kg service.
    Found 2026-09-05 while lowering the threshold to 400 zł on the owner's
    instruction that "the method is still decide by the size - like we can't
    use paczkomat for to big package", which is what turned a latent
    ordering mistake into one that fires on more carts.

    Gross, deliberately, and stated here because BUG-08 was entirely a
    disagreement about this line. The schema comment and the admin form both
    said the threshold was net while this compared gross, so free shipping
    began 23% early - and a 709,16 zł cart showed all four methods at „0,00
    zł" while the shop absorbed a real 51,61 zł InPost tier.

    Fixed by correcting those two descriptions, not this comparison: „wydaj
    400 zł" should mean the number on the customer's cart, and moving the
    code to net would have raised the real threshold by 23% on a live shop.
    Pinned by `tests/unit/delivery-pricing.test.ts`.
  */
  if (method.freeShippingThresholdGrosze !== null && cart.subtotalGrossGrosze >= method.freeShippingThresholdGrosze) {
    return { feasible: true, priceGrosze: 0, matchedTierLabelPl: null, freeShippingApplied: true };
  }
  return carriage;
}

/**
 * Can this carrier take this parcel, and at what published price?
 *
 * Everything here is a fact about the parcel and the carrier's own rate
 * card. Nothing the shop decides belongs in it - see the threshold in
 * `evaluateDeliveryMethod`, which applies on top of the answer.
 */
function resolveCarriage(
  method: DeliveryPriceInfo,
  cart: { readonly subtotalGrossGrosze: number; readonly items: readonly CartWeightItem[] },
): DeliveryEvaluation {
  if (method.weightTiers.length === 0) {
    return { feasible: true, priceGrosze: method.priceGrosze, matchedTierLabelPl: null, freeShippingApplied: false };
  }

  const cartWeightGrams = computeCartWeightGrams(cart.items);

  // Real InPost Paczkomat sizes aren't just weight brackets with a shared
  // shape - XS is a genuinely SMALLER opening than A/B/C, not just
  // shallower - so each tier's own weight ceiling AND its own dimensions
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
      return { feasible: true, priceGrosze: tier.priceGrosze, matchedTierLabelPl: tier.labelPl, freeShippingApplied: false };
    }
    const opening = { openingWidthMm: tier.maxWidthMm, openingHeightMm: tier.maxHeightMm, maxDepthMm: tier.maxDepthMm };
    const everyItemFits = cart.items.every((item) => {
      if (item.widthMm === null || item.heightMm === null) {
        return true; // nothing real to check against - never block on missing data
      }
      const thicknessMm = item.thicknessMm ?? 18;
      return fitsLockerOpening({ widthMm: item.widthMm, heightMm: item.heightMm, thicknessMm }, opening);
    });
    if (everyItemFits) {
      return { feasible: true, priceGrosze: tier.priceGrosze, matchedTierLabelPl: tier.labelPl, freeShippingApplied: false };
    }
    sawWeightCapacityWithoutFit = true;
  }

  // Nothing matched. If at least one tier had enough weight capacity but
  // rejected on size, that's the more specific, more useful reason to
  // surface than a generic weight ceiling.
  return { feasible: false, reason: sawWeightCapacityWithoutFit ? 'ITEM_TOO_LARGE' : 'TOO_HEAVY' };
}

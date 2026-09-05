import { describe, expect, it } from 'vitest';

import { evaluateDeliveryMethod } from '@/domain/checkout/delivery';
import type { DeliveryPriceInfo } from '@/domain/checkout/delivery';
import type { CartWeightItem } from '@/domain/shipping/weight';

const SMALL_ITEM: CartWeightItem = { widthMm: 200, heightMm: 150, thicknessMm: 10, materialDensityKgPerM3: 750, quantity: 1 };
const OVERSIZED_ITEM: CartWeightItem = { widthMm: 700, heightMm: 500, thicknessMm: 12, materialDensityKgPerM3: 750, quantity: 1 };

describe('evaluateDeliveryMethod - free-shipping threshold', () => {
  const method: DeliveryPriceInfo = { priceGrosze: 1_500, freeShippingThresholdGrosze: 30_000, weightTiers: [] };

  it('charges the flat rate below the threshold', () => {
    expect(evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [SMALL_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 1_500,
      matchedTierLabelPl: null,
      freeShippingApplied: false,
    });
  });

  it('is free once the subtotal meets the threshold - wins over a tier that would have charged', () => {
    /*
      Rewritten 2026-09-05, and the change of intent is the point. This used
      to assert that the threshold wins over a weight ceiling too: the tier
      below carried `maxWeightGrams: 1`, which no real cart clears, and the
      old code returned free anyway because it tested the threshold before
      it measured anything.

      That is no longer the rule. Feasibility is physical and the threshold
      is commercial, so the tier here now has a ceiling the cart genuinely
      clears, and what is pinned is what the threshold is actually for:
      overriding a real, payable price with zero. The refusals it must NOT
      override have their own block at the bottom of this file.
    */
    const withTiers: DeliveryPriceInfo = {
      ...method,
      weightTiers: [{ labelPl: 'ciężka', maxWeightGrams: 50_000, priceGrosze: 99_999, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null }],
    };
    expect(evaluateDeliveryMethod(withTiers, { subtotalGrossGrosze: 30_000, items: [OVERSIZED_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 0,
      matchedTierLabelPl: null,
      freeShippingApplied: true,
    });
  });
});

describe('evaluateDeliveryMethod - no weight tiers (flat-rate fallback, e.g. Odbiór osobisty)', () => {
  it('always returns the flat price, regardless of cart weight', () => {
    const method: DeliveryPriceInfo = { priceGrosze: 0, freeShippingThresholdGrosze: null, weightTiers: [] };
    expect(evaluateDeliveryMethod(method, { subtotalGrossGrosze: 1_000, items: [OVERSIZED_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 0,
      matchedTierLabelPl: null,
      // Zero, and NOT free shipping - this is `Odbiór osobisty`, which is
      // free because nothing is shipped rather than because the cart earned
      // it. UX-07, and the reason the flag exists at all.
      freeShippingApplied: false,
    });
  });
});

describe('evaluateDeliveryMethod - real weight tiers', () => {
  const method: DeliveryPriceInfo = {
    priceGrosze: 1_500,
    freeShippingThresholdGrosze: null,
    weightTiers: [
      { labelPl: 'do 1 kg', maxWeightGrams: 1_000, priceGrosze: 1_649, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null },
      { labelPl: 'do 5 kg', maxWeightGrams: 5_000, priceGrosze: 1_849, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null },
      { labelPl: 'do 25 kg', maxWeightGrams: 25_000, priceGrosze: 2_049, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null },
    ],
  };

  it('picks the cheapest tier the cart weight clears', () => {
    // SMALL_ITEM: 0.2*0.15*0.01*750*1000 = 225g, well under 1kg
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [SMALL_ITEM] });
    expect(result).toEqual({ feasible: true, priceGrosze: 1_649, matchedTierLabelPl: 'do 1 kg', freeShippingApplied: false });
  });

  it('escalates to a heavier tier for a heavier cart', () => {
    const heavyItem: CartWeightItem = { widthMm: 300, heightMm: 300, thicknessMm: 40, materialDensityKgPerM3: 750, quantity: 1 }; // 2700g
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [heavyItem] });
    expect(result).toEqual({ feasible: true, priceGrosze: 1_849, matchedTierLabelPl: 'do 5 kg', freeShippingApplied: false });
  });

  it('is infeasible (TOO_HEAVY) once the cart exceeds every tier - never silently charges the heaviest tier’s price', () => {
    const veryHeavyItem: CartWeightItem = { widthMm: 300, heightMm: 300, thicknessMm: 400, materialDensityKgPerM3: 750, quantity: 1 }; // 27kg
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [veryHeavyItem] });
    expect(result).toEqual({ feasible: false, reason: 'TOO_HEAVY' });
  });
});

describe('evaluateDeliveryMethod - real locker dimension fit (InPost Paczkomat)', () => {
  const method: DeliveryPriceInfo = {
    priceGrosze: 1_500,
    freeShippingThresholdGrosze: null,
    weightTiers: [
      { labelPl: 'XS', maxWeightGrams: 3_000, priceGrosze: 1_149, maxWidthMm: 380, maxHeightMm: 640, maxDepthMm: 40 },
      { labelPl: 'C', maxWeightGrams: 25_000, priceGrosze: 2_049, maxWidthMm: 380, maxHeightMm: 640, maxDepthMm: 410 },
    ],
  };

  it('is feasible for an item that fits a real locker', () => {
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [SMALL_ITEM] });
    expect(result.feasible).toBe(true);
  });

  it('is infeasible (ITEM_TOO_LARGE) for a real oversized wall-art panel - never silently ships it anyway', () => {
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [OVERSIZED_ITEM] });
    expect(result).toEqual({ feasible: false, reason: 'ITEM_TOO_LARGE' });
  });

  it('never blocks on an item with no recorded dimensions to check', () => {
    const noDimsItem: CartWeightItem = { widthMm: null, heightMm: null, thicknessMm: null, materialDensityKgPerM3: null, quantity: 1 };
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [noDimsItem] });
    expect(result.feasible).toBe(true);
  });
});

/**
 * `docs/REVIEW-DETAILED.md` BUG-08 - the free-shipping threshold compared
 * **gross** against a field the schema, and the admin form, both called
 * **net**. Free shipping therefore began 23% earlier than the documented
 * policy: with the seeded 500 zł threshold, at 406,50 zł net.
 *
 * Observed live before the fix: a 709,16 zł cart showed all four delivery
 * methods at „0,00 zł - Darmowa dostawa", while the real InPost tier for its
 * computed weight is 51,61 zł, absorbed by the shop.
 *
 * **Resolved as gross, and that direction is the point.** The review's own
 * note says gross is the better rule - "wydaj 500 zł" should mean the number
 * the customer sees on the cart, not a figure they would have to divide by
 * 1.23 to recognise. So the code was already doing the more defensible
 * thing; what was wrong was every description of it. Switching the *code* to
 * net would have quietly raised the real threshold by 23% on a live shop -
 * a pricing change, not a bug fix, and not one to make on a schema comment's
 * say-so.
 *
 * These pin the unit so the next reader cannot re-open the same question by
 * reading the comment and trusting it.
 */
describe('evaluateDeliveryMethod - which subtotal the free-shipping threshold compares (BUG-08)', () => {
  const method = { priceGrosze: 1_500, freeShippingThresholdGrosze: 50_000, weightTiers: [] };

  it('is free at exactly the threshold, measured gross', () => {
    const evaluation = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 50_000, items: [] });

    expect(evaluation).toEqual({ feasible: true, priceGrosze: 0, matchedTierLabelPl: null, freeShippingApplied: true });
  });

  it('is not free one grosz below it', () => {
    // The boundary in the direction that costs the shop money if it is wrong.
    const evaluation = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 49_999, items: [] });

    expect(evaluation.feasible && evaluation.priceGrosze).toBe(1_500);
  });

  it('does not become free at the net equivalent of the threshold', () => {
    /*
      The regression this exists to catch, in the only direction that can
      still happen: somebody reads „netto" somewhere and converts the
      comparison. 50 000 grosze gross is 40 650 net at 23% VAT, and a cart
      of exactly that must still pay for delivery.
    */
    const evaluation = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 40_650, items: [] });

    expect(evaluation.feasible && evaluation.priceGrosze).toBe(1_500);
  });

  it('never becomes free when no threshold is configured', () => {
    const evaluation = evaluateDeliveryMethod(
      { ...method, freeShippingThresholdGrosze: null },
      { subtotalGrossGrosze: 10_000_000, items: [] },
    );

    expect(evaluation.feasible && evaluation.priceGrosze).toBe(1_500);
  });
});

/**
 * Owner decision, 2026-09-05: free delivery above 400 zl gross, and "the
 * method is still decide by the size - like we can't use paczkomat for to
 * big package".
 *
 * That second half was already true for a paying cart and quietly false for
 * a free one. `evaluateDeliveryMethod` tested the threshold **first** and
 * returned immediately, so a cart over the threshold was handed a locker
 * method at 0,00 zl without the locker ever being measured - and the same
 * cart one grosz below the threshold was correctly refused as
 * ITEM_TOO_LARGE. Lowering the threshold from 500 to 400 zl makes it fire
 * on more carts, which is what turned a latent ordering mistake into
 * something worth fixing now.
 *
 * The rule these pin: **feasibility is physical, price is commercial.**
 * Whether a carrier will take the parcel is a fact about the parcel; the
 * threshold only decides what the shop charges for a carriage that can
 * actually happen. No discount makes a 30 kg parcel fit a 25 kg service.
 */
describe('evaluateDeliveryMethod - free shipping never rescues a method that cannot carry the cart', () => {
  const locker: DeliveryPriceInfo = {
    priceGrosze: 1_500,
    freeShippingThresholdGrosze: 40_000,
    weightTiers: [
      { labelPl: 'XS', maxWeightGrams: 3_000, priceGrosze: 1_149, maxWidthMm: 380, maxHeightMm: 640, maxDepthMm: 40 },
      { labelPl: 'C', maxWeightGrams: 25_000, priceGrosze: 2_049, maxWidthMm: 380, maxHeightMm: 640, maxDepthMm: 410 },
    ],
  };

  it('still refuses an oversized panel when the cart is over the threshold', () => {
    // The exact case the owner named. Below the threshold this already
    // answered ITEM_TOO_LARGE; above it, the same physical parcel was
    // offered free.
    expect(evaluateDeliveryMethod(locker, { subtotalGrossGrosze: 40_000, items: [OVERSIZED_ITEM] })).toEqual({
      feasible: false,
      reason: 'ITEM_TOO_LARGE',
    });
  });

  it('still refuses a cart heavier than every tier when it is over the threshold', () => {
    const heavy: CartWeightItem = { ...SMALL_ITEM, quantity: 400 };
    expect(evaluateDeliveryMethod(locker, { subtotalGrossGrosze: 40_000, items: [heavy] })).toEqual({
      feasible: false,
      reason: 'TOO_HEAVY',
    });
  });

  it('is still free for a cart the method can actually carry', () => {
    // The override itself is untouched - this is the guard that fixing the
    // ordering did not quietly disable free delivery.
    expect(evaluateDeliveryMethod(locker, { subtotalGrossGrosze: 40_000, items: [SMALL_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 0,
      matchedTierLabelPl: null,
      freeShippingApplied: true,
    });
  });

  it('charges the real tier one grosz below the threshold', () => {
    expect(evaluateDeliveryMethod(locker, { subtotalGrossGrosze: 39_999, items: [SMALL_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 1_149,
      matchedTierLabelPl: 'XS',
      freeShippingApplied: false,
    });
  });
});

/**
 * UX-07 - „Odbiór osobisty" announced „Darmowa dostawa", and there is no
 * shipping to be free of.
 *
 * Two different zeroes were being reported as one. A cart that crosses the
 * free-shipping threshold has *earned* free delivery, and telling the
 * customer so is worth doing. Personal collection is zero because nothing is
 * being shipped at all - it costs nothing at 10 zł and nothing at 10 000 zł,
 * and „Twoje zamówienie kwalifikuje się do darmowej wysyłki" is simply untrue
 * of it. The same false note would appear on any method a shop prices at zero
 * flat.
 *
 * So the evaluation now says *why* it is free, and the checkout only
 * celebrates the threshold. The method's own description already explains
 * collection („Bezpłatny odbiór osobisty po wcześniejszym umówieniu terminu").
 */
describe('evaluateDeliveryMethod - why a delivery is free (UX-07)', () => {
  it('reports free shipping as applied when the cart crossed the threshold', () => {
    const method: DeliveryPriceInfo = { priceGrosze: 1_500, freeShippingThresholdGrosze: 40_000, weightTiers: [] };
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 40_000, items: [SMALL_ITEM] });

    expect(result).toEqual({ feasible: true, priceGrosze: 0, matchedTierLabelPl: null, freeShippingApplied: true });
  });

  it('does not claim free shipping for a method that is simply free - personal collection', () => {
    // `Odbiór osobisty` exactly as seeded: no price, no threshold, no tiers.
    const collection: DeliveryPriceInfo = { priceGrosze: 0, freeShippingThresholdGrosze: null, weightTiers: [] };
    const result = evaluateDeliveryMethod(collection, { subtotalGrossGrosze: 1_000, items: [SMALL_ITEM] });

    expect(result).toEqual({ feasible: true, priceGrosze: 0, matchedTierLabelPl: null, freeShippingApplied: false });
  });

  it('does not claim free shipping below the threshold', () => {
    const method: DeliveryPriceInfo = { priceGrosze: 1_500, freeShippingThresholdGrosze: 40_000, weightTiers: [] };
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 39_999, items: [SMALL_ITEM] });

    expect(result.feasible && result.freeShippingApplied).toBe(false);
  });

  it('does not claim free shipping for a real weight tier that happens to cost nothing', () => {
    // A shop can price a tier at zero as a promotion. It is still carriage,
    // and it is still not the threshold that made it free.
    const method: DeliveryPriceInfo = {
      priceGrosze: 1_500,
      freeShippingThresholdGrosze: null,
      weightTiers: [{ labelPl: 'do 1 kg', maxWeightGrams: 10_000, priceGrosze: 0, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null }],
    };
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 1_000, items: [SMALL_ITEM] });

    expect(result).toEqual({ feasible: true, priceGrosze: 0, matchedTierLabelPl: 'do 1 kg', freeShippingApplied: false });
  });
});

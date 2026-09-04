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
    });
  });

  it('is free once the subtotal meets the threshold - wins over any weight tier', () => {
    const withTiers: DeliveryPriceInfo = {
      ...method,
      weightTiers: [{ labelPl: 'ciężka', maxWeightGrams: 1, priceGrosze: 99_999, maxWidthMm: null, maxHeightMm: null, maxDepthMm: null }],
    };
    expect(evaluateDeliveryMethod(withTiers, { subtotalGrossGrosze: 30_000, items: [OVERSIZED_ITEM] })).toEqual({
      feasible: true,
      priceGrosze: 0,
      matchedTierLabelPl: null,
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
    expect(result).toEqual({ feasible: true, priceGrosze: 1_649, matchedTierLabelPl: 'do 1 kg' });
  });

  it('escalates to a heavier tier for a heavier cart', () => {
    const heavyItem: CartWeightItem = { widthMm: 300, heightMm: 300, thicknessMm: 40, materialDensityKgPerM3: 750, quantity: 1 }; // 2700g
    const result = evaluateDeliveryMethod(method, { subtotalGrossGrosze: 10_000, items: [heavyItem] });
    expect(result).toEqual({ feasible: true, priceGrosze: 1_849, matchedTierLabelPl: 'do 5 kg' });
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

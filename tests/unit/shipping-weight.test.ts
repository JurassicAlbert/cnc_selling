import { describe, expect, it } from 'vitest';

import { computeCartWeightGrams, computeItemWeightGrams, fitsLockerOpening } from '@/domain/shipping/weight';

describe('computeItemWeightGrams', () => {
  it('computes real weight from geometry × material density', () => {
    // 0.5m × 0.4m × 0.02m = 0.004 m³ × 750 kg/m³ = 3 kg = 3000 g
    expect(computeItemWeightGrams({ widthMm: 500, heightMm: 400, thicknessMm: 20, materialDensityKgPerM3: 750 })).toBe(3000);
  });

  it('falls back to a documented default thickness when none is recorded', () => {
    // 1m × 1m × 0.018m (fallback) × 750 kg/m³ = 13.5 kg = 13500 g
    expect(computeItemWeightGrams({ widthMm: 1000, heightMm: 1000, thicknessMm: null, materialDensityKgPerM3: 750 })).toBe(13_500);
  });

  it('falls back to a small nominal weight when there is no real geometry to compute from at all', () => {
    expect(computeItemWeightGrams({ widthMm: null, heightMm: null, thicknessMm: null, materialDensityKgPerM3: null })).toBe(150);
    expect(computeItemWeightGrams({ widthMm: 500, heightMm: 500, thicknessMm: 20, materialDensityKgPerM3: null })).toBe(150);
  });

  it('never returns zero, even for a vanishingly small item', () => {
    expect(computeItemWeightGrams({ widthMm: 1, heightMm: 1, thicknessMm: 1, materialDensityKgPerM3: 100 })).toBeGreaterThanOrEqual(1);
  });
});

describe('computeCartWeightGrams', () => {
  it('sums weight × quantity across every line', () => {
    const total = computeCartWeightGrams([
      { widthMm: 500, heightMm: 400, thicknessMm: 20, materialDensityKgPerM3: 750, quantity: 2 }, // 3000g × 2
      { widthMm: 200, heightMm: 200, thicknessMm: 10, materialDensityKgPerM3: 480, quantity: 1 },
    ]);
    // 6000 + round(0.2*0.2*0.01*480*1000) = 6000 + 192
    expect(total).toBe(6000 + 192);
  });

  it('is zero for an empty cart', () => {
    expect(computeCartWeightGrams([])).toBe(0);
  });
});

describe('fitsLockerOpening', () => {
  const inpostSizeC = { openingWidthMm: 380, openingHeightMm: 640, maxDepthMm: 410 };

  it('fits a small item that clears the opening in its natural orientation', () => {
    expect(fitsLockerOpening({ widthMm: 300, heightMm: 600, thicknessMm: 50 }, inpostSizeC)).toBe(true);
  });

  it('fits an item that only clears the opening when rotated', () => {
    // 600mm wide, 300mm tall — doesn't fit width<=380 directly, but rotates to fit height<=640/width<=380
    expect(fitsLockerOpening({ widthMm: 600, heightMm: 300, thicknessMm: 50 }, inpostSizeC)).toBe(true);
  });

  it('rejects a real oversized wall-art panel — the actual case this check exists for', () => {
    // A real seeded product size (700×500mm) genuinely does not fit any InPost locker opening (max 380×640mm)
    expect(fitsLockerOpening({ widthMm: 700, heightMm: 500, thicknessMm: 12 }, inpostSizeC)).toBe(false);
  });

  it('rejects an item that fits the face but is too deep for the size', () => {
    expect(fitsLockerOpening({ widthMm: 300, heightMm: 600, thicknessMm: 450 }, inpostSizeC)).toBe(false);
  });
});

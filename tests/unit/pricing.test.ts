import { describe, expect, it } from 'vitest';

import { calculatePrice } from '@/domain/pricing/calculate';
import type { PricingInput } from '@/domain/pricing/types';
import { PricingError } from '@/domain/pricing/types';

/**
 * A deliberately plain baseline: 1 m², every rate round, every factor neutral,
 * no personalization, one module, one unit. Each test perturbs exactly one
 * thing, so a failure names its own cause.
 */
const BASE: PricingInput = {
  pricingVersion: 1,
  basePriceGrosze: 10_000, // 100,00 zł
  minPriceGrosze: 0,
  widthMm: 1000,
  heightMm: 1000, // 1 m²
  material: { pricePerM2Grosze: 20_000, priceFactorBp: 10_000 },
  thicknessFactorBp: 10_000,
  design: {
    machiningMilliMinutesPerM2: 10_000, // 10 min/m²
    surchargeGrosze: 0,
    method: 'CNC_CARVE',
  },
  machineRates: { cncPerMinuteGrosze: 100, laserPerMinuteGrosze: 200 },
  finish: { pricePerM2Grosze: 5_000, setupFeeGrosze: 1_000 },
  modules: { count: 1, surchargePerExtraModuleGrosze: 3_000 },
  personalization: {
    characterCount: 0,
    flatFeeGrosze: 2_000,
    pricePerCharacterGrosze: 100,
  },
  installationFactorBp: 10_000,
  packagingGrosze: 1_500,
  vatRateBp: 2_300,
  quantity: 1,
};

function priceOf(overrides: Partial<PricingInput> = {}) {
  return calculatePrice({ ...BASE, ...overrides });
}

describe('calculatePrice — components in isolation', () => {
  it('charges material by area', () => {
    // 1 m² x 200,00 zł/m² = 200,00 zł
    expect(priceOf().components.materialGrosze).toBe(20_000);
  });

  it('halves the material cost for half the area', () => {
    expect(priceOf({ heightMm: 500 }).components.materialGrosze).toBe(10_000);
  });

  it('applies the material and thickness factors together, rounding once', () => {
    const result = priceOf({
      material: { pricePerM2Grosze: 20_000, priceFactorBp: 11_000 },
      thicknessFactorBp: 12_000,
    });
    // 20000 x 1.1 x 1.2 = 26400
    expect(result.components.materialGrosze).toBe(26_400);
  });

  it('charges machining by time and rate', () => {
    // 1 m² x 10 min x 1,00 zł/min = 10,00 zł
    expect(priceOf().components.machiningGrosze).toBe(1_000);
  });

  it('bills laser work at the laser rate', () => {
    const result = priceOf({
      design: { ...BASE.design, method: 'LASER_ENGRAVE' },
    });
    expect(result.components.machiningGrosze).toBe(2_000);
  });

  it('bills mixed and manual-prep work at the CNC rate for now', () => {
    for (const method of ['MIXED', 'MANUAL_PREP', 'CNC_ENGRAVE'] as const) {
      const result = priceOf({ design: { ...BASE.design, method } });
      expect(result.components.machiningGrosze, method).toBe(1_000);
    }
  });

  it('charges the finish by area plus a setup fee', () => {
    // 1 m² x 50,00 zł + 10,00 zł setup
    expect(priceOf().components.finishGrosze).toBe(6_000);
  });

  it('charges nothing extra for a single module', () => {
    expect(priceOf().components.modulesGrosze).toBe(0);
  });

  it('charges per EXTRA module, not per module', () => {
    expect(priceOf({ modules: { ...BASE.modules, count: 6 } }).components.modulesGrosze).toBe(
      15_000,
    );
  });

  it('charges nothing for personalization when there is no text', () => {
    expect(priceOf().components.personalizationGrosze).toBe(0);
  });

  it('charges a flat fee plus per-character once there is text', () => {
    const result = priceOf({
      personalization: { ...BASE.personalization, characterCount: 7 },
    });
    // 20,00 zł + 7 x 1,00 zł
    expect(result.components.personalizationGrosze).toBe(2_700);
  });

  it('adds the design surcharge unchanged', () => {
    expect(
      priceOf({ design: { ...BASE.design, surchargeGrosze: 4_321 } }).components
        .designSurchargeGrosze,
    ).toBe(4_321);
  });
});

describe('calculatePrice — assembly', () => {
  it('reconciles: components sum to the subtotal', () => {
    const { components, componentsSubtotalGrosze } = priceOf();
    const sum = Object.values(components).reduce((a, b) => a + b, 0);
    expect(sum).toBe(componentsSubtotalGrosze);
  });

  it('computes the baseline total end to end', () => {
    const result = priceOf();
    // base 10000 + material 20000 + machining 1000 + design 0
    // + finish 6000 + modules 0 + personalization 0 = 37000
    expect(result.componentsSubtotalGrosze).toBe(37_000);
    // x1.00 installation, + 1500 packaging
    expect(result.unitNetGrosze).toBe(38_500);
    expect(result.unitVatGrosze).toBe(8_855);
    expect(result.unitGrossGrosze).toBe(47_355);
  });

  it('applies the installation variant factor before packaging', () => {
    const result = priceOf({ installationFactorBp: 12_000 });
    expect(result.afterInstallationFactorGrosze).toBe(44_400);
    expect(result.unitNetGrosze).toBe(45_900);
  });

  it('does not multiply packaging by the installation factor', () => {
    const withFactor = priceOf({ installationFactorBp: 20_000 });
    const withoutFactor = priceOf({ installationFactorBp: 10_000 });
    expect(withFactor.unitNetGrosze - withFactor.afterInstallationFactorGrosze).toBe(
      withoutFactor.unitNetGrosze - withoutFactor.afterInstallationFactorGrosze,
    );
  });
});

describe('calculatePrice — the minimum price clamp', () => {
  it('leaves a price above the floor alone', () => {
    const result = priceOf({ minPriceGrosze: 10_000 });
    expect(result.minimumApplied).toBe(false);
    expect(result.unitNetGrosze).toBe(38_500);
  });

  it('raises a price below the floor and says so', () => {
    const result = priceOf({ minPriceGrosze: 50_000 });
    expect(result.minimumApplied).toBe(true);
    expect(result.unitNetGrosze).toBe(50_000);
    // The breakdown still shows what it would have been.
    expect(result.netBeforeMinimumGrosze).toBe(38_500);
  });

  it('does not apply the floor when the price exactly equals it', () => {
    const result = priceOf({ minPriceGrosze: 38_500 });
    expect(result.minimumApplied).toBe(false);
  });
});

describe('calculatePrice — VAT and quantity', () => {
  it('computes VAT on the unit price, then multiplies', () => {
    const result = priceOf({ quantity: 3 });
    expect(result.unitVatGrosze).toBe(8_855);
    expect(result.lineNetGrosze).toBe(115_500);
    expect(result.lineVatGrosze).toBe(26_565);
    expect(result.lineGrossGrosze).toBe(142_065);
  });

  it('keeps net + VAT === gross at both unit and line level', () => {
    const result = priceOf({ quantity: 7, basePriceGrosze: 12_345 });
    expect(result.unitNetGrosze + result.unitVatGrosze).toBe(result.unitGrossGrosze);
    expect(result.lineNetGrosze + result.lineVatGrosze).toBe(result.lineGrossGrosze);
  });

  it('rounds VAT half-up on an awkward unit price', () => {
    // Chosen so the unit net lands on 8,99 zł.
    const result = priceOf({
      basePriceGrosze: 899,
      material: { pricePerM2Grosze: 0, priceFactorBp: 10_000 },
      design: { ...BASE.design, machiningMilliMinutesPerM2: 0 },
      finish: { pricePerM2Grosze: 0, setupFeeGrosze: 0 },
      packagingGrosze: 0,
    });
    expect(result.unitNetGrosze).toBe(899);
    expect(result.unitVatGrosze).toBe(207);
  });

  it('supports a zero VAT rate without dividing by anything', () => {
    const result = priceOf({ vatRateBp: 0 });
    expect(result.unitVatGrosze).toBe(0);
    expect(result.unitGrossGrosze).toBe(result.unitNetGrosze);
  });
});

describe('calculatePrice — version pinning', () => {
  it('echoes the pricing version into the breakdown', () => {
    expect(priceOf({ pricingVersion: 42 }).pricingVersion).toBe(42);
  });

  it('produces a different price for a different rate set, so pinning matters', () => {
    const before = priceOf();
    const after = priceOf({
      pricingVersion: 2,
      material: { pricePerM2Grosze: 30_000, priceFactorBp: 10_000 },
    });
    expect(after.unitNetGrosze).not.toBe(before.unitNetGrosze);
  });
});

describe('calculatePrice — determinism', () => {
  it('returns identical results for identical input', () => {
    expect(priceOf()).toEqual(priceOf());
  });

  it('never produces a fractional grosz anywhere in the breakdown', () => {
    const result = priceOf({
      widthMm: 1337,
      heightMm: 911,
      material: { pricePerM2Grosze: 23_456, priceFactorBp: 10_777 },
      thicknessFactorBp: 11_333,
      design: { ...BASE.design, machiningMilliMinutesPerM2: 7_777 },
      personalization: { ...BASE.personalization, characterCount: 13 },
      installationFactorBp: 10_450,
      quantity: 3,
    });
    const amounts = [
      ...Object.values(result.components),
      result.componentsSubtotalGrosze,
      result.afterInstallationFactorGrosze,
      result.netBeforeMinimumGrosze,
      result.unitNetGrosze,
      result.unitVatGrosze,
      result.unitGrossGrosze,
      result.lineNetGrosze,
      result.lineVatGrosze,
      result.lineGrossGrosze,
    ];
    for (const amount of amounts) {
      expect(Number.isSafeInteger(amount)).toBe(true);
    }
  });
});

describe('calculatePrice — invalid input is rejected, never coerced', () => {
  it('rejects a zero quantity', () => {
    expect(() => priceOf({ quantity: 0 })).toThrow(PricingError);
  });

  it('rejects a fractional quantity', () => {
    expect(() => priceOf({ quantity: 1.5 })).toThrow(PricingError);
  });

  it('rejects a zero dimension', () => {
    expect(() => priceOf({ widthMm: 0 })).toThrow(PricingError);
  });

  it('rejects a negative dimension', () => {
    expect(() => priceOf({ heightMm: -100 })).toThrow(PricingError);
  });

  it('rejects a fractional millimetre', () => {
    expect(() => priceOf({ widthMm: 100.5 })).toThrow(PricingError);
  });

  it('rejects a zero module count', () => {
    expect(() => priceOf({ modules: { ...BASE.modules, count: 0 } })).toThrow(
      PricingError,
    );
  });

  it('rejects a negative rate', () => {
    expect(() =>
      priceOf({
        machineRates: { cncPerMinuteGrosze: -1, laserPerMinuteGrosze: 200 },
      }),
    ).toThrow(PricingError);
  });

  it('rejects a fractional machining time, which must be milli-minutes', () => {
    expect(() =>
      priceOf({ design: { ...BASE.design, machiningMilliMinutesPerM2: 2.5 } }),
    ).toThrow(PricingError);
  });

  it('rejects a negative character count', () => {
    expect(() =>
      priceOf({ personalization: { ...BASE.personalization, characterCount: -1 } }),
    ).toThrow(PricingError);
  });
});

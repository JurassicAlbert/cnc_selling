import { describe, expect, it } from 'vitest';

import { calculatePrice } from '@/domain/pricing/calculate';
import { validateDimensions } from '@/domain/dimensions/dimensions';
import { splitIntoModules } from '@/domain/modules/split';
import { evaluateFeasibility } from '@/domain/feasibility/rules';
import { validatePersonalization } from '@/domain/personalization/validate';
import {
  MappingError,
  packagingGroszeFor,
  toDesignConstraints,
  toDimensionEnvelope,
  toFontSpec,
  toMachineConstraints,
  toMaterialConstraints,
  toPersonalizationSpec,
  toPricingInput,
  toSplitLimits,
} from '@/server/mapping/to-domain';
import type {
  DesignRow,
  FontRow,
  MachineSettingsRow,
  MaterialRow,
  PersonalizationSpecRow,
  PricingRows,
  PricingSettingsRow,
  ProductRow,
} from '@/server/mapping/to-domain';

/**
 * These tests guard the seam between the database and the domain layer.
 *
 * The domain is already covered by its own suite; what is untested elsewhere is
 * the conversion — micrometres to millimetres, basis points to ratios, a
 * nullable finish to a zero-cost finish. A silent mistake here does not throw:
 * it produces a plausible, wrong price. So the assertions below are on exact
 * values, not on shapes.
 */

const material: MaterialRow = {
  pricePerM2Grosze: 18_000,
  maxSheetWidthMm: 1200,
  maxSheetHeightMm: 2400,
  minLineWidthUm: 1200, // 1.2 mm
  minDetailSpacingUm: 800, // 0.8 mm
  minTextHeightUm: 6000, // 6 mm
  isNaturalVariable: true,
};

const design: DesignRow = {
  referenceWidthMm: 600,
  minLineWidthUm: 1500, // 1.5 mm at the reference width
  minDetailSpacingUm: 1000,
  detailLevel: 3,
  minRecommendedWidthMm: 300,
  machiningMilliMinutesPerM2: 2500, // 2.5 min/m²
  recommendedMethod: 'CNC_CARVE',
};

const product: ProductRow = {
  basePriceGrosze: 9_900,
  minPriceGrosze: 12_000,
  minWidthMm: 200,
  maxWidthMm: 1200,
  minHeightMm: 200,
  maxHeightMm: 1200,
  minAspectRatioBp: 2000, // 0.2
  maxAspectRatioBp: 50_000, // 5.0
};

const pricingSettings: PricingSettingsRow = {
  version: 3,
  machineRateCncGrosze: 15_000,
  machineRateLaserGrosze: 12_000,
  moduleSurchargeGrosze: 4_000,
  vatRateBp: 2300,
  packagingTiers: [
    { maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 },
    { maxAreaM2: 2, maxModules: 4, priceGrosze: 4_500 },
    { maxAreaM2: null, maxModules: null, priceGrosze: 9_000 },
  ],
};

const machine: MachineSettingsRow = {
  usableWidthMm: 580,
  usableHeightMm: 880,
  minModuleMm: 150,
  maxWorkpieceThicknessMm: 100,
};

function pricingRows(overrides: Partial<PricingRows> = {}): PricingRows {
  return {
    product,
    material,
    productMaterial: { priceFactorBp: 11_500 },
    thickness: { priceFactorBp: 10_000 },
    design,
    productDesign: { surchargeGrosze: 3_000 },
    finish: { pricePerM2Grosze: 6_000, setupFeeGrosze: 2_000 },
    installationVariant: null,
    personalizationSpec: null,
    pricing: pricingSettings,
    widthMm: 400,
    heightMm: 600,
    moduleCount: 1,
    personalizationText: null,
    quantity: 1,
    ...overrides,
  };
}

describe('toDimensionEnvelope', () => {
  it('passes millimetre bounds through unchanged', () => {
    const envelope = toDimensionEnvelope(product);

    expect(envelope.minWidthMm).toBe(200);
    expect(envelope.maxWidthMm).toBe(1200);
    expect(envelope.minHeightMm).toBe(200);
    expect(envelope.maxHeightMm).toBe(1200);
  });

  it('converts aspect-ratio basis points to the ratio the domain expects', () => {
    const envelope = toDimensionEnvelope(product);

    expect(envelope.minAspectRatio).toBe(0.2);
    expect(envelope.maxAspectRatio).toBe(5);
  });

  it('maps an absent aspect limit to null rather than to zero', () => {
    // 0 would forbid nothing at the max end and everything at the min end;
    // conflating "no limit" with 0 is the classic version of this bug.
    const envelope = toDimensionEnvelope({
      ...product,
      minAspectRatioBp: null,
      maxAspectRatioBp: null,
    });

    expect(envelope.minAspectRatio).toBeNull();
    expect(envelope.maxAspectRatio).toBeNull();
  });

  it('produces an envelope the domain accepts and rejects correctly', () => {
    const envelope = toDimensionEnvelope(product);

    expect(validateDimensions({ widthMm: 400, heightMm: 600 }, envelope)).toEqual([]);
    expect(
      validateDimensions({ widthMm: 200, heightMm: 1200 }, envelope).map((i) => i.code),
    ).toEqual(['ASPECT_RATIO_TOO_NARROW']);
  });
});

describe('toSplitLimits', () => {
  it('takes the stricter of the machine area and the material sheet', () => {
    const limits = toSplitLimits(machine, {
      ...material,
      maxSheetWidthMm: 500, // narrower than the machine
      maxSheetHeightMm: 2400, // wider than the machine
    });

    expect(limits.usableWidthMm).toBe(500);
    expect(limits.usableHeightMm).toBe(880);
    expect(limits.minModuleMm).toBe(150);
  });

  it('keeps the exact-boundary behaviour of the domain intact', () => {
    const limits = toSplitLimits(machine, material);
    const result = splitIntoModules(580, 880, limits);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Exactly the usable area is ONE module, not two.
      expect(result.layout.totalModules).toBe(1);
    }
  });
});

describe('toMachineConstraints', () => {
  it('carries the Z-axis limit through unchanged — it is already integer mm', () => {
    expect(toMachineConstraints(machine).maxWorkpieceThicknessMm).toBe(100);
  });

  it('rejects a non-integer value instead of rounding it away', () => {
    expect(() =>
      toMachineConstraints({ ...machine, maxWorkpieceThicknessMm: 100.5 }),
    ).toThrow(MappingError);
  });
});

describe('toDesignConstraints and toMaterialConstraints', () => {
  it('converts micrometres to the millimetres the domain compares in', () => {
    expect(toDesignConstraints(design).minLineWidthMm).toBe(1.5);
    expect(toDesignConstraints(design).minDetailSpacingMm).toBe(1);
    expect(toMaterialConstraints(material).minLineWidthMm).toBe(1.2);
    expect(toMaterialConstraints(material).minDetailSpacingMm).toBe(0.8);
  });

  it('carries the reference width, detail level and recommended width through', () => {
    const constraints = toDesignConstraints(design);

    expect(constraints.referenceWidthMm).toBe(600);
    expect(constraints.detailLevel).toBe(3);
    expect(constraints.minRecommendedWidthMm).toBe(300);
  });

  it('rejects a non-integer micrometre value instead of rounding it away', () => {
    expect(() => toMaterialConstraints({ ...material, minLineWidthUm: 1200.5 })).toThrow(
      MappingError,
    );
  });

  it('feeds a feasibility verdict that matches the underlying rows', () => {
    // A design declaring 1.5 mm lines at 600 mm, produced at 300 mm, has
    // 0.75 mm lines — below the material's 1.2 mm minimum.
    const findings = evaluateFeasibility({
      widthMm: 300,
      design: toDesignConstraints(design),
      material: toMaterialConstraints(material),
      moduleCount: 1,
      isFloorElement: false,
      thicknessMm: null,
      machine: toMachineConstraints(machine),
    });

    const line = findings.find((f) => f.code === 'LINE_TOO_THIN');
    expect(line?.severity).toBe('error');
    expect(line?.params['effectiveLineWidthMm']).toBe(0.75);
    expect(line?.params['requiredMm']).toBe(1.2);
  });
});

describe('toPersonalizationSpec', () => {
  const spec: PersonalizationSpecRow = {
    isEnabled: true,
    maxCharacters: 40,
    maxLines: 2,
    minTextHeightUm: 5000, // 5 mm — the product is willing to go smaller
    flatFeeGrosze: 1_500,
    pricePerCharGrosze: 100,
  };

  it('uses the stricter of the product and material minimum text heights', () => {
    // The material cannot hold text below 6 mm; the product's 5 mm does not
    // override physics.
    expect(toPersonalizationSpec(spec, material).minTextHeightMm).toBe(6);
  });

  it('uses the product minimum when it is the stricter of the two', () => {
    const strictProduct = { ...spec, minTextHeightUm: 8000 };
    expect(toPersonalizationSpec(strictProduct, material).minTextHeightMm).toBe(8);
  });

  it('carries the character and line limits through', () => {
    const mapped = toPersonalizationSpec(spec, material);
    expect(mapped.maxCharacters).toBe(40);
    expect(mapped.maxLines).toBe(2);
  });
});

describe('toFontSpec', () => {
  const font: FontRow = {
    id: 'font_1',
    minHeightUm: 4500, // 4.5 mm
    // Basic Latin plus the Polish letters this face actually contains.
    coveredCodePointRanges: [
      [32, 126],
      [0x104, 0x107],
      [0x141, 0x144],
    ],
  };

  it('expands inclusive ranges into the coverage set', () => {
    const mapped = toFontSpec(font);

    expect(mapped.supportedCodePoints.has(32)).toBe(true); // first of range
    expect(mapped.supportedCodePoints.has(126)).toBe(true); // last of range, inclusive
    expect(mapped.supportedCodePoints.has(127)).toBe(false);
    expect(mapped.supportedCodePoints.has(0x104)).toBe(true); // Ą
    expect(mapped.supportedCodePoints.has(0x142)).toBe(true); // ł
  });

  it('converts the minimum legible height from micrometres', () => {
    expect(toFontSpec(font).minHeightMm).toBe(4.5);
  });

  it('rejects a malformed range rather than silently covering nothing', () => {
    expect(() => toFontSpec({ ...font, coveredCodePointRanges: [[126, 32]] })).toThrow(
      MappingError,
    );
    expect(() => toFontSpec({ ...font, coveredCodePointRanges: 'latin' })).toThrow(
      MappingError,
    );
    expect(() => toFontSpec({ ...font, coveredCodePointRanges: [[32]] })).toThrow(
      MappingError,
    );
  });

  it('makes an uncovered Polish letter a hard error downstream', () => {
    // The face above has ł but no ż. „Zażółć" must be rejected, not rendered
    // with a fallback glyph and then carved.
    const issues = validatePersonalization(
      { text: 'Zażółć', textHeightMm: 10 },
      toPersonalizationSpec(
        {
          isEnabled: true,
          maxCharacters: 40,
          maxLines: 2,
          minTextHeightUm: 6000,
          flatFeeGrosze: 0,
          pricePerCharGrosze: 0,
        },
        material,
      ),
      toFontSpec(font),
    );

    expect(issues.map((i) => i.code)).toContain('UNSUPPORTED_CHARACTER');
  });
});

describe('packagingGroszeFor', () => {
  const tiers = pricingSettings.packagingTiers;

  it('picks the first tier whose limits the product fits inside', () => {
    expect(packagingGroszeFor(tiers, 0.24, 1)).toBe(1_500); // 400 x 600 mm
    expect(packagingGroszeFor(tiers, 1.44, 4)).toBe(4_500); // 1200 x 1200 mm
  });

  it('falls through to a later tier when the module count exceeds the first', () => {
    // Small area, but four modules do not fit the single-module tier.
    expect(packagingGroszeFor(tiers, 0.24, 4)).toBe(4_500);
  });

  it('treats a null limit as unbounded', () => {
    expect(packagingGroszeFor(tiers, 12, 40)).toBe(9_000);
  });

  it('throws when no tier matches rather than quietly charging nothing', () => {
    const bounded = [{ maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 }];
    expect(() => packagingGroszeFor(bounded, 4, 1)).toThrow(MappingError);
  });

  it('rejects malformed tier JSON', () => {
    expect(() => packagingGroszeFor('cheap', 1, 1)).toThrow(MappingError);
    expect(() => packagingGroszeFor([{ priceGrosze: 1.5 }], 1, 1)).toThrow(MappingError);
  });
});

describe('toPricingInput', () => {
  it('maps every rate into the domain input by name', () => {
    const input = toPricingInput(pricingRows());

    expect(input.pricingVersion).toBe(3);
    expect(input.basePriceGrosze).toBe(9_900);
    expect(input.minPriceGrosze).toBe(12_000);
    expect(input.widthMm).toBe(400);
    expect(input.heightMm).toBe(600);
    expect(input.material.pricePerM2Grosze).toBe(18_000);
    expect(input.material.priceFactorBp).toBe(11_500);
    expect(input.thicknessFactorBp).toBe(10_000);
    expect(input.design.machiningMilliMinutesPerM2).toBe(2500);
    expect(input.design.surchargeGrosze).toBe(3_000);
    expect(input.design.method).toBe('CNC_CARVE');
    expect(input.machineRates.cncPerMinuteGrosze).toBe(15_000);
    expect(input.machineRates.laserPerMinuteGrosze).toBe(12_000);
    expect(input.finish.pricePerM2Grosze).toBe(6_000);
    expect(input.finish.setupFeeGrosze).toBe(2_000);
    expect(input.modules.surchargePerExtraModuleGrosze).toBe(4_000);
    expect(input.vatRateBp).toBe(2300);
    expect(input.quantity).toBe(1);
  });

  it('maps an unselected finish to zero cost, not to a missing key', () => {
    const input = toPricingInput(pricingRows({ finish: null }));

    expect(input.finish.pricePerM2Grosze).toBe(0);
    expect(input.finish.setupFeeGrosze).toBe(0);
  });

  it('maps an absent thickness or installation variant to a neutral factor', () => {
    const input = toPricingInput(
      pricingRows({ thickness: null, installationVariant: null }),
    );

    // 10000 bp = x1.00. A missing factor must never become 0, which would
    // make the product free.
    expect(input.thicknessFactorBp).toBe(10_000);
    expect(input.installationFactorBp).toBe(10_000);
  });

  it('applies the installation variant factor when one is chosen', () => {
    const input = toPricingInput(
      pricingRows({ installationVariant: { priceFactorBp: 8_500 } }),
    );

    expect(input.installationFactorBp).toBe(8_500);
  });

  it('counts personalization characters the way the validator does', () => {
    const input = toPricingInput(
      pricingRows({
        personalizationSpec: {
          isEnabled: true,
          maxCharacters: 40,
          maxLines: 2,
          minTextHeightUm: 6000,
          flatFeeGrosze: 1_500,
          pricePerCharGrosze: 100,
        },
        // Two lines: the newline is not a billable character, and „ł" is one
        // character, not two.
        personalizationText: 'Michał\nAnna',
      }),
    );

    expect(input.personalization.characterCount).toBe(10);
    expect(input.personalization.flatFeeGrosze).toBe(1_500);
    expect(input.personalization.pricePerCharacterGrosze).toBe(100);
  });

  it('charges nothing for personalization when the product has no spec', () => {
    const input = toPricingInput(
      pricingRows({ personalizationSpec: null, personalizationText: 'Michał' }),
    );

    expect(input.personalization.characterCount).toBe(0);
    expect(input.personalization.flatFeeGrosze).toBe(0);
    expect(input.personalization.pricePerCharacterGrosze).toBe(0);
  });

  it('resolves packaging from the tier table for the mapped area', () => {
    // 400 x 600 mm = 0.24 m², one module -> the first tier.
    expect(toPricingInput(pricingRows()).packagingGrosze).toBe(1_500);
  });

  it('rejects a rate set whose money columns are not integers', () => {
    expect(() =>
      toPricingInput(
        pricingRows({
          pricing: { ...pricingSettings, machineRateCncGrosze: 150.5 },
        }),
      ),
    ).toThrow(MappingError);
  });

  it('rejects dimensions that are not integer millimetres', () => {
    expect(() => toPricingInput(pricingRows({ widthMm: 400.5 }))).toThrow(MappingError);
  });

  it('rejects a module count below one', () => {
    expect(() => toPricingInput(pricingRows({ moduleCount: 0 }))).toThrow(MappingError);
  });
});

describe('the mapped input priced end to end', () => {
  /**
   * The drift alarm. If a column is renamed, retyped or silently reinterpreted,
   * this number moves — and a moved number here means every price on the site
   * moved. Derivation, in grosze:
   *
   *   area              0.24 m² (400 x 600 mm)
   *   base                                          9 900
   *   material   0.24 x 18 000 = 4 320, x1.15 =     4 968
   *   machining  0.24 x 2.5 min x 15 000 =          9 000
   *   design surcharge                              3 000
   *   finish     0.24 x 6 000 = 1 440 + 2 000 =     3 440
   *   modules    (1 - 1) x 4 000 =                      0
   *   personalization                                   0
   *                                              --------
   *   components subtotal                          30 308
   *   x installation factor 1.00                   30 308
   *   + packaging                                   1 500
   *                                              --------
   *   net unit (above the 12 000 minimum)          31 808
   *   VAT 23%                                       7 316
   *   gross unit                                   39 124
   */
  it('produces the derivation the comment above spells out', () => {
    const breakdown = calculatePrice(toPricingInput(pricingRows()));

    expect(breakdown.components.baseGrosze).toBe(9_900);
    expect(breakdown.components.materialGrosze).toBe(4_968);
    expect(breakdown.components.machiningGrosze).toBe(9_000);
    expect(breakdown.components.designSurchargeGrosze).toBe(3_000);
    expect(breakdown.components.finishGrosze).toBe(3_440);
    expect(breakdown.components.modulesGrosze).toBe(0);
    expect(breakdown.componentsSubtotalGrosze).toBe(30_308);
    expect(breakdown.packagingGrosze).toBe(1_500);
    expect(breakdown.unitNetGrosze).toBe(31_808);
    expect(breakdown.unitVatGrosze).toBe(7_316);
    expect(breakdown.unitGrossGrosze).toBe(39_124);
    expect(breakdown.pricingVersion).toBe(3);
  });

  it('carries the module surcharge through for a product that must be split', () => {
    const limits = toSplitLimits(machine, material);
    const split = splitIntoModules(1200, 1200, limits);
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    const breakdown = calculatePrice(
      toPricingInput(
        pricingRows({
          widthMm: 1200,
          heightMm: 1200,
          moduleCount: split.layout.totalModules,
        }),
      ),
    );

    // 1200 x 1200 against 580 x 880 usable: 3 columns x 2 rows.
    expect(split.layout.totalModules).toBe(6);
    expect(breakdown.components.modulesGrosze).toBe(5 * 4_000);
    // 1.44 m², six modules -> the unbounded tier.
    expect(breakdown.packagingGrosze).toBe(9_000);
  });

  it('clamps to the product minimum price when the components fall below it', () => {
    const breakdown = calculatePrice(
      toPricingInput(
        pricingRows({
          product: { ...product, basePriceGrosze: 0, minPriceGrosze: 100_000 },
          finish: null,
          productDesign: { surchargeGrosze: 0 },
        }),
      ),
    );

    expect(breakdown.minimumApplied).toBe(true);
    expect(breakdown.unitNetGrosze).toBe(100_000);
  });
});

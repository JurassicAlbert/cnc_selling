import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTIONS, type Selections } from '@/domain/configuration/steps';
import { resolveOptionAvailability, resolveOptions } from '@/server/configurator/resolve-options';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import type { ConfiguratorPricingData } from '@/server/configurator/price-configuration';
import type { FontRow, PersonalizationSpecRow } from '@/server/mapping/to-domain';

/**
 * The server-side glue between `domain/compatibility` / `domain/pricing` /
 * `domain/feasibility` / `domain/modules` and a real product's rows —
 * ARCHITECTURE.md §7.1's `derived` state and §7.2's option resolution.
 * Fixture-driven, exactly like `tests/unit/mapping.test.ts`: no database, a
 * mistake here does not throw, it produces a plausible wrong price or option
 * list.
 */

function selections(overrides: Partial<Selections>): Selections {
  return { ...EMPTY_SELECTIONS, ...overrides };
}

// ---------------------------------------------------------------------------
// resolveOptions
// ---------------------------------------------------------------------------

const optionData: ConfiguratorOptionData = {
  materials: [
    {
      id: 'dab',
      namePl: 'Dąb',
      isAvailable: true,
      finishes: [
        { id: 'olejowanie', namePl: 'Olejowanie', isAvailable: true },
        { id: 'lakierowanie', namePl: 'Lakierowanie', isAvailable: false },
      ],
    },
    {
      id: 'gres-bialy',
      namePl: 'Gres biały',
      isAvailable: true,
      finishes: [], // matches the seed script's real gap: gres has no finish rows yet
    },
    {
      id: 'unavailable-material',
      namePl: 'Materiał niedostępny',
      isAvailable: false,
      finishes: [{ id: 'olejowanie', namePl: 'Olejowanie', isAvailable: true }],
    },
  ],
  designs: [
    {
      id: 'wzor-podstawowy',
      namePl: 'Wzór podstawowy',
      isActive: true,
      rightsStatus: 'APPROVED_COMMERCIAL',
      allowedMaterialIds: [], // unrestricted
    },
    {
      id: 'wzor-tylko-dab',
      namePl: 'Wzór tylko na dąb',
      isActive: true,
      rightsStatus: 'APPROVED_COMMERCIAL',
      allowedMaterialIds: ['dab'],
    },
    {
      id: 'wzor-nieaktywny',
      namePl: 'Wzór wycofany',
      isActive: false,
      rightsStatus: 'APPROVED_COMMERCIAL',
      allowedMaterialIds: [],
    },
  ],
  thicknesses: [
    { thicknessMm: 18, labelPl: '18 mm' },
    { thicknessMm: 27, labelPl: '27 mm' },
  ],
  installVariants: [
    {
      code: 'ON_TOP',
      namePl: 'Na istniejący kafelek',
      descPl: '',
      receivesPl: '',
      diagramUrl: '/diagrams/on-top.svg',
      maxThicknessMm: null,
    },
    {
      code: 'OVERLAY',
      namePl: 'Nakładka cienka',
      descPl: '',
      receivesPl: '',
      diagramUrl: '/diagrams/overlay.svg',
      maxThicknessMm: 18,
    },
  ],
  fonts: [{ id: 'inter', namePl: 'Inter' }],
};

describe('resolveOptions', () => {
  it('offers every available material when no design narrows them', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.materialIds).toEqual(['dab', 'gres-bialy']); // unavailable-material excluded
  });

  it('narrows materials to a design that restricts them', () => {
    const result = resolveOptions(optionData, selections({ designId: 'wzor-tylko-dab' }));
    expect(result.materialIds).toEqual(['dab']);
  });

  it('offers every active, sellable design when no material narrows them', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.designIds).toEqual(['wzor-podstawowy', 'wzor-tylko-dab']); // inactive excluded
  });

  it('narrows designs once a material that some designs exclude is chosen', () => {
    const result = resolveOptions(optionData, selections({ materialId: 'gres-bialy' }));
    expect(result.designIds).toEqual(['wzor-podstawowy']); // wzor-tylko-dab excluded
  });

  it('offers no finish before a material is chosen', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.finishIds).toEqual([]);
  });

  it("offers the chosen material's finishes", () => {
    const result = resolveOptions(optionData, selections({ materialId: 'dab' }));
    expect(result.finishIds).toEqual(['olejowanie']);
  });

  it('offers no finish for a material with no MaterialFinish rows (gres today)', () => {
    const result = resolveOptions(optionData, selections({ materialId: 'gres-bialy' }));
    expect(result.finishIds).toEqual([]);
  });

  it('offers every thickness when no installation variant caps it', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.thicknessesMm).toEqual([18, 27]);
  });

  it('caps thickness options to the chosen installation variant', () => {
    const result = resolveOptions(optionData, selections({ installationVariant: 'OVERLAY' }));
    expect(result.thicknessesMm).toEqual([18]);
  });

  it('lists every installation variant, unfiltered', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.installVariantCodes).toEqual(['ON_TOP', 'OVERLAY']);
  });

  it('lists every font, unfiltered — no compatibility rule narrows font choice', () => {
    const result = resolveOptions(optionData, EMPTY_SELECTIONS);
    expect(result.fontIds).toEqual(['inter']);
  });
});

describe('resolveOptionAvailability — every option, annotated, never hidden (§7.2)', () => {
  it('marks a structurally unavailable material with its own reason', () => {
    const result = resolveOptionAvailability(optionData, EMPTY_SELECTIONS);
    const entry = result.materials.find((m) => m.id === 'unavailable-material');
    expect(entry).toEqual({
      id: 'unavailable-material',
      namePl: 'Materiał niedostępny',
      isAvailable: false,
      reason: 'MATERIAL_NOT_OFFERED',
    });
  });

  it('marks an otherwise-available material excluded by the chosen design', () => {
    const result = resolveOptionAvailability(
      optionData,
      selections({ designId: 'wzor-tylko-dab' }),
    );
    const gres = result.materials.find((m) => m.id === 'gres-bialy');
    expect(gres).toEqual({
      id: 'gres-bialy',
      namePl: 'Gres biały',
      isAvailable: false,
      reason: 'EXCLUDED_BY_DESIGN',
    });
  });

  it('a material unavailable for BOTH reasons reports the more fundamental one', () => {
    const result = resolveOptionAvailability(
      optionData,
      selections({ designId: 'wzor-tylko-dab' }),
    );
    const entry = result.materials.find((m) => m.id === 'unavailable-material');
    expect(entry?.reason).toBe('MATERIAL_NOT_OFFERED'); // not EXCLUDED_BY_DESIGN
  });

  it('lists every material, including available ones, with a null reason', () => {
    const result = resolveOptionAvailability(optionData, EMPTY_SELECTIONS);
    expect(result.materials.map((m) => m.id)).toEqual(['dab', 'gres-bialy', 'unavailable-material']);
    const dab = result.materials.find((m) => m.id === 'dab');
    expect(dab).toEqual({ id: 'dab', namePl: 'Dąb', isAvailable: true, reason: null });
  });

  it('marks an inactive/non-sellable design unavailable regardless of material', () => {
    const result = resolveOptionAvailability(optionData, EMPTY_SELECTIONS);
    const entry = result.designs.find((d) => d.id === 'wzor-nieaktywny');
    expect(entry).toEqual({
      id: 'wzor-nieaktywny',
      namePl: 'Wzór wycofany',
      isAvailable: false,
      reason: 'DESIGN_NOT_OFFERED',
    });
  });

  it('marks a design excluded by the chosen material', () => {
    const result = resolveOptionAvailability(optionData, selections({ materialId: 'gres-bialy' }));
    const entry = result.designs.find((d) => d.id === 'wzor-tylko-dab');
    expect(entry).toEqual({
      id: 'wzor-tylko-dab',
      namePl: 'Wzór tylko na dąb',
      isAvailable: false,
      reason: 'EXCLUDED_BY_MATERIAL',
    });
  });

  it('marks a structurally unavailable finish, once a material is chosen', () => {
    const result = resolveOptionAvailability(optionData, selections({ materialId: 'dab' }));
    const entry = result.finishes.find((f) => f.id === 'lakierowanie');
    expect(entry).toEqual({
      id: 'lakierowanie',
      namePl: 'Lakierowanie',
      isAvailable: false,
      reason: 'FINISH_NOT_OFFERED',
    });
  });

  it('lists no finishes before a material is chosen', () => {
    const result = resolveOptionAvailability(optionData, EMPTY_SELECTIONS);
    expect(result.finishes).toEqual([]);
  });

  it('marks a thickness excluded by the chosen installation variant', () => {
    const result = resolveOptionAvailability(
      optionData,
      selections({ installationVariant: 'OVERLAY' }),
    );
    const entry = result.thicknesses.find((t) => t.id === '27');
    expect(entry).toEqual({
      id: '27',
      namePl: '27 mm',
      isAvailable: false,
      reason: 'THICKNESS_EXCEEDS_INSTALLATION_VARIANT',
    });
  });

  it('marks every font as always available, with a null reason', () => {
    const result = resolveOptionAvailability(optionData, EMPTY_SELECTIONS);
    expect(result.fonts).toEqual([
      { id: 'inter', namePl: 'Inter', isAvailable: true, reason: null },
    ]);
  });
});

// ---------------------------------------------------------------------------
// priceConfiguration
// ---------------------------------------------------------------------------

const pricingData: ConfiguratorPricingData = {
  product: {
    basePriceGrosze: 12_000,
    minPriceGrosze: 15_000,
    minWidthMm: 200,
    maxWidthMm: 1200,
    minHeightMm: 200,
    maxHeightMm: 1200,
    minAspectRatioBp: null,
    maxAspectRatioBp: null,
    isFloorElement: false,
  },
  material: {
    priceFactorBp: 10_000,
    pricePerM2Grosze: 18_000,
    maxSheetWidthMm: 1200,
    maxSheetHeightMm: 2400,
    minLineWidthUm: 1200,
    minDetailSpacingUm: 800,
    minTextHeightUm: 6000,
    isNaturalVariable: true,
  },
  design: {
    surchargeGrosze: 0,
    referenceWidthMm: 600,
    minLineWidthUm: 1500,
    minDetailSpacingUm: 1000,
    detailLevel: 3,
    minRecommendedWidthMm: 300,
    machiningMilliMinutesPerM2: 2500,
    recommendedMethod: 'CNC_CARVE',
  },
  finish: { pricePerM2Grosze: 4_000, setupFeeGrosze: 1_000 },
  thickness: null,
  installationVariant: null,
  personalizationSpec: null,
  font: null,
  machine: {
    usableWidthMm: 600,
    usableHeightMm: 500,
    minModuleMm: 150,
    maxWorkpieceThicknessMm: 100,
  },
  pricing: {
    version: 1,
    machineRateCncGrosze: 200,
    machineRateLaserGrosze: 150,
    moduleSurchargeGrosze: 5_000,
    vatRateBp: 2300,
    packagingTiers: [{ maxAreaM2: null, maxModules: null, priceGrosze: 2_500 }],
  },
};

describe('priceConfiguration', () => {
  it('is incomplete before a size is chosen', () => {
    const result = priceConfiguration(pricingData, EMPTY_SELECTIONS, 1);
    expect(result.status).toBe('incomplete');
  });

  it('rejects a size outside the product envelope', () => {
    const result = priceConfiguration(
      pricingData,
      selections({ widthMm: 50, heightMm: 400 }),
      1,
    );
    expect(result.status).toBe('dimension_invalid');
    if (result.status === 'dimension_invalid') {
      expect(result.issues.some((issue) => issue.code === 'WIDTH_BELOW_MIN')).toBe(true);
    }
  });

  it('prices a valid single-module configuration', () => {
    const result = priceConfiguration(
      pricingData,
      selections({ widthMm: 600, heightMm: 400 }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.moduleLayout.totalModules).toBe(1);
      expect(result.blockingError).toBe(false);
      expect(result.priceBreakdown.quantity).toBe(1);
      expect(result.priceBreakdown.unitGrossGrosze).toBeGreaterThan(0);
    }
  });

  it('splits into modules and prices the module surcharge when oversize', () => {
    const result = priceConfiguration(
      pricingData,
      selections({ widthMm: 1200, heightMm: 400 }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.moduleLayout.totalModules).toBe(2);
      expect(result.feasibility.some((f) => f.code === 'MODULAR_BUILD')).toBe(true);
    }
  });

  it('flags a blocking feasibility error but still returns a price for the summary', () => {
    const thinLineData: ConfiguratorPricingData = {
      ...pricingData,
      // The material demands a much wider line than this design ever produces.
      material: { ...pricingData.material, minLineWidthUm: 50_000 }, // 50 mm
    };
    const result = priceConfiguration(
      thinLineData,
      selections({ widthMm: 600, heightMm: 400 }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.blockingError).toBe(true);
      expect(result.feasibility.some((f) => f.code === 'LINE_TOO_THIN')).toBe(true);
      expect(result.priceBreakdown).toBeDefined();
    }
  });

  it('rejects a thickness the machine cannot fit, as a feasibility error not a crash', () => {
    const result = priceConfiguration(
      pricingData,
      selections({ widthMm: 600, heightMm: 400, thicknessMm: 150 }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.blockingError).toBe(true);
      expect(result.feasibility.some((f) => f.code === 'THICKNESS_EXCEEDS_MACHINE')).toBe(true);
    }
  });

  it('multiplies the line total by quantity', () => {
    const one = priceConfiguration(pricingData, selections({ widthMm: 600, heightMm: 400 }), 1);
    const three = priceConfiguration(pricingData, selections({ widthMm: 600, heightMm: 400 }), 3);
    if (one.status === 'priced' && three.status === 'priced') {
      expect(three.priceBreakdown.lineGrossGrosze).toBe(one.priceBreakdown.unitGrossGrosze * 3);
    } else {
      throw new Error('expected both to price');
    }
  });
});

// ---------------------------------------------------------------------------
// priceConfiguration — personalization (§7.1, domain/personalization)
// ---------------------------------------------------------------------------

const personalizationSpecFixture: PersonalizationSpecRow = {
  isEnabled: true,
  maxCharacters: 20,
  maxLines: 1,
  minTextHeightUm: 3_000,
  flatFeeGrosze: 1_000,
  pricePerCharGrosze: 50,
};

// Basic Latin + Latin-1 Supplement + Latin Extended-A — covers every Polish
// diacritic (ó sits in Latin-1 Supplement, the rest in Latin Extended-A) but
// nothing outside those three blocks, so an em dash is a real gap to test.
const fontFixture: FontRow = {
  id: 'inter',
  minHeightUm: 3_000,
  coveredCodePointRanges: [
    [32, 126],
    [160, 255],
    [256, 383],
  ],
};

describe('priceConfiguration — personalization', () => {
  const base: ConfiguratorPricingData = {
    ...pricingData,
    personalizationSpec: personalizationSpecFixture,
  };

  it('has no personalization issues when no text is entered — it is optional', () => {
    const result = priceConfiguration(base, selections({ widthMm: 600, heightMm: 400 }), 1);
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.personalizationIssues).toEqual([]);
      expect(result.personalizationFontRequired).toBe(false);
      expect(result.blockingError).toBe(false);
    }
  });

  it('requires a font once text is entered, before any coverage check can run', () => {
    const result = priceConfiguration(
      base,
      selections({ widthMm: 600, heightMm: 400, personalizationText: 'Michał' }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.personalizationFontRequired).toBe(true);
      expect(result.personalizationIssues).toEqual([]);
      expect(result.blockingError).toBe(true);
    }
  });

  it('accepts text made only of characters the chosen font actually covers', () => {
    const result = priceConfiguration(
      { ...base, font: fontFixture },
      selections({ widthMm: 600, heightMm: 400, personalizationText: 'Michał' }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.personalizationFontRequired).toBe(false);
      expect(result.personalizationIssues).toEqual([]);
      expect(result.blockingError).toBe(false);
    }
  });

  it('reports a character genuinely outside the font\'s cmap as a blocking issue — the mistake an engraving cannot undo', () => {
    const result = priceConfiguration(
      { ...base, font: fontFixture },
      selections({ widthMm: 600, heightMm: 400, personalizationText: 'Ala—Ola' }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.personalizationIssues).toEqual([
        { code: 'UNSUPPORTED_CHARACTER', character: '—' },
      ]);
      expect(result.blockingError).toBe(true);
    }
  });

  it('does not evaluate personalization for a product that does not offer it', () => {
    const result = priceConfiguration(
      { ...pricingData, font: fontFixture }, // personalizationSpec stays null
      selections({ widthMm: 600, heightMm: 400, personalizationText: 'Ola' }),
      1,
    );
    expect(result.status).toBe('priced');
    if (result.status === 'priced') {
      expect(result.personalizationIssues).toEqual([]);
      expect(result.personalizationFontRequired).toBe(false);
      expect(result.blockingError).toBe(false);
    }
  });
});

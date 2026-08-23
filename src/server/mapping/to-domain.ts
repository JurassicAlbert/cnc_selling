/**
 * The seam between the database and the domain layer.
 *
 * `src/domain` is pure: every rate, limit and tolerance is passed in as an
 * argument. This module is the one place allowed to turn a Prisma row into
 * those arguments, and it exists as its own file — rather than being inlined
 * into each Server Action — for one reason: a mistake here does not throw. It
 * produces a plausible, wrong price, or a feasibility verdict that quietly
 * passes something the machine cannot cut.
 *
 * Three conversions happen here and nowhere else:
 *
 *   micrometres -> millimetres    minLineWidthUm 1200 -> 1.2
 *   basis points -> ratio         minAspectRatioBp 2000 -> 0.2
 *   nullable row -> neutral value an unselected finish costs 0; an absent
 *                                 factor is 10000 bp (x1.00), NEVER 0
 *
 * The row types are `Pick`s of the generated Prisma model types, so renaming a
 * column stops this file compiling instead of changing a price.
 */

import type { DimensionEnvelope } from '@/domain/dimensions/dimensions';
import type {
  DesignConstraints,
  MaterialConstraints,
} from '@/domain/feasibility/rules';
import type { SplitLimits } from '@/domain/modules/split';
import type {
  FontSpec,
  PersonalizationSpec as DomainPersonalizationSpec,
} from '@/domain/personalization/validate';
import { countPersonalizationCharacters } from '@/domain/personalization/validate';
import { BASIS_POINTS } from '@/domain/money/money';
import type { PricingInput } from '@/domain/pricing/types';

import type {
  DesignModel,
  FinishModel,
  FontModel,
  InstallationVariantModel,
  MachineSettingsModel,
  MaterialModel,
  PersonalizationSpecModel,
  PricingSettingsModel,
  ProductDesignModel,
  ProductMaterialModel,
  ProductModel,
  ProductThicknessModel,
} from '@/generated/prisma/models';

export class MappingError extends Error {
  override name = 'MappingError';
}

/** Micrometres in a millimetre. 1200 um = 1.2 mm. */
const UM_PER_MM = 1_000;
/** Square millimetres in a square metre. */
const MM2_PER_M2 = 1_000_000;
/** A factor that leaves an amount unchanged. */
const NEUTRAL_FACTOR_BP = BASIS_POINTS;

// ---------------------------------------------------------------------------
// Row shapes — deliberately the narrowest slice of each model that is needed
// ---------------------------------------------------------------------------

export type ProductRow = Pick<
  ProductModel,
  | 'basePriceGrosze'
  | 'minPriceGrosze'
  | 'minWidthMm'
  | 'maxWidthMm'
  | 'minHeightMm'
  | 'maxHeightMm'
  | 'minAspectRatioBp'
  | 'maxAspectRatioBp'
>;

export type MaterialRow = Pick<
  MaterialModel,
  | 'pricePerM2Grosze'
  | 'maxSheetWidthMm'
  | 'maxSheetHeightMm'
  | 'minLineWidthUm'
  | 'minDetailSpacingUm'
  | 'minTextHeightUm'
  | 'isNaturalVariable'
>;

export type DesignRow = Pick<
  DesignModel,
  | 'referenceWidthMm'
  | 'minLineWidthUm'
  | 'minDetailSpacingUm'
  | 'detailLevel'
  | 'minRecommendedWidthMm'
  | 'machiningMilliMinutesPerM2'
  | 'recommendedMethod'
>;

export type MachineSettingsRow = Pick<
  MachineSettingsModel,
  'usableWidthMm' | 'usableHeightMm' | 'minModuleMm'
>;

export type PersonalizationSpecRow = Pick<
  PersonalizationSpecModel,
  | 'isEnabled'
  | 'maxCharacters'
  | 'maxLines'
  | 'minTextHeightUm'
  | 'flatFeeGrosze'
  | 'pricePerCharGrosze'
>;

export type FontRow = Pick<FontModel, 'id' | 'minHeightUm' | 'coveredCodePointRanges'>;

export type PricingSettingsRow = Pick<
  PricingSettingsModel,
  | 'version'
  | 'machineRateCncGrosze'
  | 'machineRateLaserGrosze'
  | 'moduleSurchargeGrosze'
  | 'vatRateBp'
  | 'packagingTiers'
>;

export type PricingRows = {
  readonly product: ProductRow;
  readonly material: MaterialRow;
  readonly productMaterial: Pick<ProductMaterialModel, 'priceFactorBp'>;
  /** Null for product types without a thickness step. */
  readonly thickness: Pick<ProductThicknessModel, 'priceFactorBp'> | null;
  readonly design: DesignRow;
  readonly productDesign: Pick<ProductDesignModel, 'surchargeGrosze'>;
  /** Null while the customer has not chosen a finish. */
  readonly finish: Pick<FinishModel, 'pricePerM2Grosze' | 'setupFeeGrosze'> | null;
  /** Kitchen tiles only. */
  readonly installationVariant: Pick<InstallationVariantModel, 'priceFactorBp'> | null;
  /** Null when the product does not offer personalization. */
  readonly personalizationSpec: PersonalizationSpecRow | null;
  readonly pricing: PricingSettingsRow;
  readonly widthMm: number;
  readonly heightMm: number;
  /** From `splitIntoModules`. Always at least 1. */
  readonly moduleCount: number;
  readonly personalizationText: string | null;
  readonly quantity: number;
};

// ---------------------------------------------------------------------------
// Catalogue -> domain
// ---------------------------------------------------------------------------

export function toDimensionEnvelope(product: ProductRow): DimensionEnvelope {
  return {
    minWidthMm: requireInteger(product.minWidthMm, 'product.minWidthMm'),
    maxWidthMm: requireInteger(product.maxWidthMm, 'product.maxWidthMm'),
    minHeightMm: requireInteger(product.minHeightMm, 'product.minHeightMm'),
    maxHeightMm: requireInteger(product.maxHeightMm, 'product.maxHeightMm'),
    minAspectRatio: bpToRatioOrNull(product.minAspectRatioBp, 'product.minAspectRatioBp'),
    maxAspectRatio: bpToRatioOrNull(product.maxAspectRatioBp, 'product.maxAspectRatioBp'),
  };
}

/**
 * The machine and the material each cap the module size, independently. A
 * 1200 mm-wide sheet does not help if the machine reaches 580 mm, and a
 * machine that reaches 880 mm does not help on a 600 mm sheet.
 */
export function toSplitLimits(
  machine: MachineSettingsRow,
  material: Pick<MaterialRow, 'maxSheetWidthMm' | 'maxSheetHeightMm'>,
): SplitLimits {
  return {
    usableWidthMm: Math.min(
      requireInteger(machine.usableWidthMm, 'machine.usableWidthMm'),
      requireInteger(material.maxSheetWidthMm, 'material.maxSheetWidthMm'),
    ),
    usableHeightMm: Math.min(
      requireInteger(machine.usableHeightMm, 'machine.usableHeightMm'),
      requireInteger(material.maxSheetHeightMm, 'material.maxSheetHeightMm'),
    ),
    minModuleMm: requireInteger(machine.minModuleMm, 'machine.minModuleMm'),
  };
}

export function toDesignConstraints(design: DesignRow): DesignConstraints {
  return {
    referenceWidthMm: requireInteger(design.referenceWidthMm, 'design.referenceWidthMm'),
    minLineWidthMm: umToMm(design.minLineWidthUm, 'design.minLineWidthUm'),
    minDetailSpacingMm: umToMm(design.minDetailSpacingUm, 'design.minDetailSpacingUm'),
    detailLevel: requireInteger(design.detailLevel, 'design.detailLevel'),
    minRecommendedWidthMm: requireInteger(
      design.minRecommendedWidthMm,
      'design.minRecommendedWidthMm',
    ),
  };
}

export function toMaterialConstraints(material: MaterialRow): MaterialConstraints {
  return {
    minLineWidthMm: umToMm(material.minLineWidthUm, 'material.minLineWidthUm'),
    minDetailSpacingMm: umToMm(
      material.minDetailSpacingUm,
      'material.minDetailSpacingUm',
    ),
    isNaturalVariable: material.isNaturalVariable,
  };
}

/**
 * The effective minimum text height is the STRICTER of the product's spec and
 * the material's tolerance. A product willing to engrave 5 mm text does not
 * make 5 mm text possible on a material that cannot hold it.
 */
export function toPersonalizationSpec(
  spec: PersonalizationSpecRow,
  material: Pick<MaterialRow, 'minTextHeightUm'>,
): DomainPersonalizationSpec {
  const specUm = requireInteger(spec.minTextHeightUm, 'spec.minTextHeightUm');
  const materialUm = requireInteger(
    material.minTextHeightUm,
    'material.minTextHeightUm',
  );

  return {
    maxCharacters: requireInteger(spec.maxCharacters, 'spec.maxCharacters'),
    maxLines: requireInteger(spec.maxLines, 'spec.maxLines'),
    minTextHeightMm: umToMm(Math.max(specUm, materialUm), 'minTextHeightUm'),
  };
}

/**
 * Expands the stored cmap ranges into the coverage set the validator checks
 * against.
 *
 * Ranges rather than a flat list because a full face covers thousands of code
 * points; inclusive at both ends, because that is how a cmap range is defined
 * and an off-by-one here would reject the last character of every range.
 */
export function toFontSpec(font: FontRow): FontSpec {
  const ranges = parseCodePointRanges(font.coveredCodePointRanges);
  const supportedCodePoints = new Set<number>();

  for (const [start, end] of ranges) {
    for (let codePoint = start; codePoint <= end; codePoint += 1) {
      supportedCodePoints.add(codePoint);
    }
  }

  return {
    id: font.id,
    minHeightMm: umToMm(font.minHeightUm, 'font.minHeightUm'),
    supportedCodePoints,
  };
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export type PackagingTier = {
  /** Inclusive upper bound in m². Null means unbounded. */
  readonly maxAreaM2: number | null;
  /** Inclusive upper bound on module count. Null means unbounded. */
  readonly maxModules: number | null;
  readonly priceGrosze: number;
};

/**
 * The first tier the product fits inside wins, so the table is read in the
 * order it was written.
 *
 * No matching tier is an error rather than a zero: shipping a 2 m² oak panel
 * for free because someone forgot the last row is a loss that would be
 * discovered in the accounts, not in the code.
 */
export function packagingGroszeFor(
  tiers: unknown,
  areaM2: number,
  moduleCount: number,
): number {
  const parsed = parsePackagingTiers(tiers);

  for (const tier of parsed) {
    const areaFits = tier.maxAreaM2 === null || areaM2 <= tier.maxAreaM2;
    const modulesFit = tier.maxModules === null || moduleCount <= tier.maxModules;
    if (areaFits && modulesFit) {
      return tier.priceGrosze;
    }
  }

  throw new MappingError(
    `no packaging tier covers ${areaM2} m² in ${moduleCount} module(s); ` +
      'the tier table needs an unbounded final row',
  );
}

export function toPricingInput(rows: PricingRows): PricingInput {
  const widthMm = requireInteger(rows.widthMm, 'widthMm');
  const heightMm = requireInteger(rows.heightMm, 'heightMm');
  const moduleCount = requireInteger(rows.moduleCount, 'moduleCount');
  const quantity = requireInteger(rows.quantity, 'quantity');

  if (widthMm <= 0 || heightMm <= 0) {
    throw new MappingError(
      `dimensions must be positive, received ${widthMm} x ${heightMm} mm`,
    );
  }
  if (moduleCount < 1) {
    throw new MappingError(`moduleCount must be at least 1, received ${moduleCount}`);
  }
  if (quantity < 1) {
    throw new MappingError(`quantity must be at least 1, received ${quantity}`);
  }

  const { personalizationSpec } = rows;
  const characterCount =
    personalizationSpec !== null &&
    personalizationSpec.isEnabled &&
    rows.personalizationText !== null
      ? countPersonalizationCharacters(rows.personalizationText)
      : 0;

  return {
    pricingVersion: requireInteger(rows.pricing.version, 'pricing.version'),
    basePriceGrosze: requireInteger(
      rows.product.basePriceGrosze,
      'product.basePriceGrosze',
    ),
    minPriceGrosze: requireInteger(rows.product.minPriceGrosze, 'product.minPriceGrosze'),
    widthMm,
    heightMm,
    material: {
      pricePerM2Grosze: requireInteger(
        rows.material.pricePerM2Grosze,
        'material.pricePerM2Grosze',
      ),
      priceFactorBp: requireInteger(
        rows.productMaterial.priceFactorBp,
        'productMaterial.priceFactorBp',
      ),
    },
    // A missing thickness step means "no thickness premium", which is x1.00.
    // Defaulting it to 0 would make the material free.
    thicknessFactorBp:
      rows.thickness === null
        ? NEUTRAL_FACTOR_BP
        : requireInteger(rows.thickness.priceFactorBp, 'thickness.priceFactorBp'),
    design: {
      machiningMilliMinutesPerM2: requireInteger(
        rows.design.machiningMilliMinutesPerM2,
        'design.machiningMilliMinutesPerM2',
      ),
      surchargeGrosze: requireInteger(
        rows.productDesign.surchargeGrosze,
        'productDesign.surchargeGrosze',
      ),
      method: rows.design.recommendedMethod,
    },
    machineRates: {
      cncPerMinuteGrosze: requireInteger(
        rows.pricing.machineRateCncGrosze,
        'pricing.machineRateCncGrosze',
      ),
      laserPerMinuteGrosze: requireInteger(
        rows.pricing.machineRateLaserGrosze,
        'pricing.machineRateLaserGrosze',
      ),
    },
    finish:
      rows.finish === null
        ? { pricePerM2Grosze: 0, setupFeeGrosze: 0 }
        : {
            pricePerM2Grosze: requireInteger(
              rows.finish.pricePerM2Grosze,
              'finish.pricePerM2Grosze',
            ),
            setupFeeGrosze: requireInteger(
              rows.finish.setupFeeGrosze,
              'finish.setupFeeGrosze',
            ),
          },
    modules: {
      count: moduleCount,
      surchargePerExtraModuleGrosze: requireInteger(
        rows.pricing.moduleSurchargeGrosze,
        'pricing.moduleSurchargeGrosze',
      ),
    },
    personalization: {
      characterCount,
      flatFeeGrosze:
        personalizationSpec === null
          ? 0
          : requireInteger(personalizationSpec.flatFeeGrosze, 'spec.flatFeeGrosze'),
      pricePerCharacterGrosze:
        personalizationSpec === null
          ? 0
          : requireInteger(
              personalizationSpec.pricePerCharGrosze,
              'spec.pricePerCharGrosze',
            ),
    },
    installationFactorBp:
      rows.installationVariant === null
        ? NEUTRAL_FACTOR_BP
        : requireInteger(
            rows.installationVariant.priceFactorBp,
            'installationVariant.priceFactorBp',
          ),
    packagingGrosze: packagingGroszeFor(
      rows.pricing.packagingTiers,
      (widthMm * heightMm) / MM2_PER_M2,
      moduleCount,
    ),
    vatRateBp: requireInteger(rows.pricing.vatRateBp, 'pricing.vatRateBp'),
    quantity,
  };
}

// ---------------------------------------------------------------------------
// Conversions and guards
// ---------------------------------------------------------------------------

function umToMm(value: number, label: string): number {
  return requireInteger(value, label) / UM_PER_MM;
}

function bpToRatioOrNull(value: number | null, label: string): number | null {
  if (value === null) {
    return null;
  }
  return requireInteger(value, label) / BASIS_POINTS;
}

/**
 * Every numeric column this module reads is an integer by design. A
 * non-integer means the schema and the domain have drifted apart, and that is
 * worth an exception rather than a silent `Math.round`.
 */
function requireInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new MappingError(`${label} must be a safe integer, received ${String(value)}`);
  }
  return value;
}

function parseCodePointRanges(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    throw new MappingError(
      `font.coveredCodePointRanges must be an array of [start, end] pairs, received ${describe(value)}`,
    );
  }

  return value.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new MappingError(
        `font.coveredCodePointRanges[${index}] must be a [start, end] pair, received ${describe(entry)}`,
      );
    }
    const [start, end] = entry as [unknown, unknown];
    if (
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start
    ) {
      throw new MappingError(
        `font.coveredCodePointRanges[${index}] must be ascending non-negative integers, received ${describe(entry)}`,
      );
    }
    return [start, end];
  });
}

function parsePackagingTiers(value: unknown): PackagingTier[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new MappingError(
      `pricing.packagingTiers must be a non-empty array, received ${describe(value)}`,
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new MappingError(
        `pricing.packagingTiers[${index}] must be an object, received ${describe(entry)}`,
      );
    }
    const tier = entry as Record<string, unknown>;
    const priceGrosze = tier['priceGrosze'];
    if (typeof priceGrosze !== 'number' || !Number.isSafeInteger(priceGrosze)) {
      throw new MappingError(
        `pricing.packagingTiers[${index}].priceGrosze must be an integer number of grosze, received ${describe(priceGrosze)}`,
      );
    }
    return {
      maxAreaM2: optionalNumber(tier['maxAreaM2'], `packagingTiers[${index}].maxAreaM2`),
      maxModules: optionalNumber(
        tier['maxModules'],
        `packagingTiers[${index}].maxModules`,
      ),
      priceGrosze,
    };
  });
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MappingError(`${label} must be a number or null, received ${describe(value)}`);
  }
  return value;
}

function describe(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(describe).join(', ')}]`;
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

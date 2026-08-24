/**
 * Module layout, feasibility and price for one configurator state —
 * ARCHITECTURE.md §7.1's `derived` shape. This is the one place server-side
 * pricing actually runs (§10.2: "Prices are computed only in Server
 * Actions") — a Server Action calls this, never the client.
 *
 * Scope: only product types with a `designId` (WALL_ART, TABLE_TOP,
 * KITCHEN_TILE, FLOOR_ELEMENT, LOFT_FURNITURE, JEWELRY) can be priced here.
 * `CUSTOM` has no seeded Design row to read machining time or a surcharge
 * from — a customer-uploaded design's production cost is a design-review
 * concern (P4), not something to invent a number for. `selections.designId
 * === null` simply never reaches 'priced' below; that is deliberate, not an
 * oversight.
 */

import type { DimensionIssue } from '@/domain/dimensions/dimensions';
import { validateDimensions } from '@/domain/dimensions/dimensions';
import type { FeasibilityFinding } from '@/domain/feasibility/rules';
import { evaluateFeasibility, hasBlockingError } from '@/domain/feasibility/rules';
import type { ModuleLayout, SplitErrorCode } from '@/domain/modules/split';
import { splitIntoModules } from '@/domain/modules/split';
import { calculatePrice } from '@/domain/pricing/calculate';
import type { PriceBreakdown } from '@/domain/pricing/types';
import type { PersonalizationIssue } from '@/domain/personalization/validate';
import { validatePersonalization } from '@/domain/personalization/validate';
import type { Selections } from '@/domain/configuration/steps';
import {
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
  PricingSettingsRow,
  ProductRow,
} from '@/server/mapping/to-domain';

export type ConfiguratorPricingData = {
  readonly product: ProductRow & { readonly isFloorElement: boolean };
  readonly material: MaterialRow & { readonly priceFactorBp: number };
  readonly design: DesignRow & { readonly surchargeGrosze: number };
  readonly finish: { readonly pricePerM2Grosze: number; readonly setupFeeGrosze: number } | null;
  readonly thickness: { readonly priceFactorBp: number } | null;
  readonly installationVariant: { readonly priceFactorBp: number } | null;
  readonly personalizationSpec: PersonalizationSpecRow | null;
  /** Null until the customer picks one, even on a product that offers personalization at all. */
  readonly font: FontRow | null;
  readonly machine: MachineSettingsRow;
  readonly pricing: PricingSettingsRow;
};

export type ConfiguratorPricingResult =
  | { readonly status: 'incomplete' }
  | { readonly status: 'dimension_invalid'; readonly issues: readonly DimensionIssue[] }
  | { readonly status: 'infeasible'; readonly code: SplitErrorCode; readonly detail: string }
  | {
      readonly status: 'priced';
      readonly moduleLayout: ModuleLayout;
      readonly feasibility: readonly FeasibilityFinding[];
      /** Gates "next"/add-to-cart. A price is still returned so the summary can show it. */
      readonly blockingError: boolean;
      readonly priceBreakdown: PriceBreakdown;
      /**
       * Real cmap-checked coverage/length/height issues for the entered
       * text — empty whenever there is nothing to validate yet (no text, or
       * personalization not offered for this product). `textHeightMm`
       * passed to the validator is the effective minimum
       * (`toPersonalizationSpec`'s stricter-of-spec-and-material floor),
       * not a real layout height — §7.3's 2D preview does not exist yet to
       * produce one. That means the two height-specific issue codes are an
       * approximation (worst case: the smallest size this product allows);
       * `UNSUPPORTED_CHARACTER`, the one an engraving mistake can never be
       * undone from, is checked exactly, against the font's real glyphs.
       */
      readonly personalizationIssues: readonly PersonalizationIssue[];
      /** True when text was entered but no font has been chosen yet to validate it against. */
      readonly personalizationFontRequired: boolean;
    };

export function priceConfiguration(
  data: ConfiguratorPricingData,
  selections: Selections,
  quantity: number,
): ConfiguratorPricingResult {
  const { widthMm, heightMm } = selections;
  if (widthMm === null || heightMm === null) {
    return { status: 'incomplete' };
  }

  const envelope = toDimensionEnvelope(data.product);
  const dimensionIssues = validateDimensions({ widthMm, heightMm }, envelope);
  if (dimensionIssues.length > 0) {
    return { status: 'dimension_invalid', issues: dimensionIssues };
  }

  const splitLimits = toSplitLimits(data.machine, data.material);
  const splitResult = splitIntoModules(widthMm, heightMm, splitLimits);
  if (!splitResult.ok) {
    return { status: 'infeasible', code: splitResult.code, detail: splitResult.detail };
  }
  const { layout } = splitResult;

  const feasibility = evaluateFeasibility({
    widthMm,
    design: toDesignConstraints(data.design),
    material: toMaterialConstraints(data.material),
    moduleCount: layout.totalModules,
    isFloorElement: data.product.isFloorElement,
    thicknessMm: selections.thicknessMm,
    machine: toMachineConstraints(data.machine),
  });

  const priceBreakdown = calculatePrice(
    toPricingInput({
      product: data.product,
      material: data.material,
      productMaterial: { priceFactorBp: data.material.priceFactorBp },
      thickness: data.thickness,
      design: data.design,
      productDesign: { surchargeGrosze: data.design.surchargeGrosze },
      finish: data.finish,
      installationVariant: data.installationVariant,
      personalizationSpec: data.personalizationSpec,
      pricing: data.pricing,
      widthMm,
      heightMm,
      moduleCount: layout.totalModules,
      personalizationText: selections.personalizationText,
      quantity,
    }),
  );

  const personalization = evaluatePersonalization(data, selections);

  return {
    status: 'priced',
    moduleLayout: layout,
    feasibility,
    blockingError:
      hasBlockingError(feasibility) ||
      personalization.fontRequired ||
      personalization.issues.length > 0,
    priceBreakdown,
    personalizationIssues: personalization.issues,
    personalizationFontRequired: personalization.fontRequired,
  };
}

/**
 * Optional by construction (`Selections.personalizationText` is nullable —
 * a customer may buy a piece with no engraved text at all), so "nothing
 * entered yet" is not an issue, it is the default. Once text exists, a font
 * must be chosen before it can be checked at all — `validatePersonalization`
 * needs a concrete `FontSpec`, not a guess at which face the price was
 * quoted for.
 */
function evaluatePersonalization(
  data: ConfiguratorPricingData,
  selections: Selections,
): { readonly issues: readonly PersonalizationIssue[]; readonly fontRequired: boolean } {
  const { personalizationSpec, font } = data;
  const text = selections.personalizationText;

  if (personalizationSpec === null || !personalizationSpec.isEnabled) {
    return { issues: [], fontRequired: false };
  }
  if (text === null || text.trim().length === 0) {
    return { issues: [], fontRequired: false };
  }
  if (font === null) {
    return { issues: [], fontRequired: true };
  }

  const domainSpec = toPersonalizationSpec(personalizationSpec, data.material);
  const fontSpec = toFontSpec(font);
  // See the 'priced' status's own field comment: no real 2D layout exists
  // yet to say what height this text will actually be engraved at, so the
  // effective minimum stands in for it — an approximation for the two
  // height-specific checks, exact for the coverage check that matters most.
  const issues = validatePersonalization(
    { text, textHeightMm: domainSpec.minTextHeightMm },
    domainSpec,
    fontSpec,
  );
  return { issues, fontRequired: false };
}

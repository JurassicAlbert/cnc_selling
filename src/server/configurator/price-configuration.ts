/**
 * Module layout, feasibility and price for one configurator state -
 * ARCHITECTURE.md §7.1's `derived` shape. This is the one place server-side
 * pricing actually runs (§10.2: "Prices are computed only in Server
 * Actions") - a Server Action calls this, never the client.
 *
 * `CUSTOM` (customer-uploaded artwork, no catalog `Design` row) DOES reach
 * 'priced' here - `data.design: null` is a legitimate input, not an
 * incomplete one. What it can't have is anything that depends on knowing
 * the artwork's actual complexity: `evaluateFeasibility`'s three
 * design-derived findings (`LINE_TOO_THIN`, `DETAIL_SPACING_TOO_TIGHT`,
 * `DESIGN_TOO_DETAILED`) are skipped entirely, and `calculatePrice`
 * zeroes `machiningGrosze`/`designSurchargeGrosze` rather than guessing -
 * see `domain/feasibility/rules.ts` and `domain/pricing/calculate.ts`'s
 * own comments. The price shown is a real base-price/material/finish
 * estimate ("wycena indywidualna" - individually priced, `inne`
 * category's own description), not the final figure; the actual
 * feasibility and any price adjustment happen during design review
 * (§13.3) before the order can leave `DESIGN_REVIEW` - a gate this
 * project already built (`domain/order-status/transitions.ts`).
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

/**
 * Whether a pattern's own production metadata gates what the customer may
 * order - `evaluateFeasibility`'s three design-derived findings
 * (`LINE_TOO_THIN`, `DETAIL_SPACING_TOO_TIGHT`, `DESIGN_TOO_DETAILED`).
 *
 * **Off, by owner decision on 2026-08-31:** "we should not measure patterns
 * can be printed on the product - since we decided we sell product with the
 * pattern already - the client can just define material, wymiary… there
 * shouldn't be cases where we allow something but its blocked by system -
 * this is logical issue."
 *
 * That is the right call, and the evidence agreed with it. These rules
 * scale a design's declared minimum line width from its `referenceWidthMm`
 * down to whatever size the customer picks - a genuinely useful check *when
 * the customer chooses the pattern*. But pattern selection is switched off
 * (`Configurator.tsx`'s `PATTERN_SELECTION_ENABLED`): the pattern is a
 * property of a product we already make, not something being scaled to an
 * arbitrary size on demand. So the rules were gating a decision the customer
 * never makes, against seeded placeholder metadata - every design carries an
 * identical `referenceWidthMm: 600` / `minLineWidthUm: 1200`, which was seed
 * scaffolding (`prisma/seed.ts`'s own header, D4/D5) and never a measurement
 * from the real machine.
 *
 * The result was a shop that refused itself: **every active product had
 * blocked combinations, and two were 100% unbuildable** - the bracelet
 * 132/132, the loft stool 660/792 - while still being listed, priced and
 * selectable (`docs/AI-CHECKLIST.md` BUG-35). The bracelet even told the
 * customer to "choose a larger size or a different material" when 22 cm was
 * its maximum and all four materials shared the same limit.
 *
 * Nothing is deleted. `domain/feasibility` keeps all three rules and their
 * 32 unit tests; `evaluateFeasibility` already accepts `design: null` and is
 * tested that way (it is the path `CUSTOM` uploads have always used). Every
 * other finding still applies in full - module count, natural variation,
 * floor matching, the machine's real Z-axis limit, and every personalization
 * check, because those are all real constraints on choices the customer
 * genuinely makes. Flipping this back to `true` is the entire re-enable
 * path, and it becomes meaningful the day patterns are customer-selectable
 * again **and** carry real per-design measurements.
 *
 * `tests/integration/offered-is-buildable.test.ts` is what holds the line
 * the owner actually asked for: nothing offered may be refused.
 */
const PATTERN_FEASIBILITY_ENABLED = false;

export type ConfiguratorPricingData = {
  readonly product: ProductRow & { readonly isFloorElement: boolean };
  readonly material: MaterialRow & { readonly priceFactorBp: number };
  /** `null` for CUSTOM - no catalog design (a customer-uploaded one instead, see this file's header). */
  readonly design: (DesignRow & { readonly surchargeGrosze: number }) | null;
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
       * text - empty whenever there is nothing to validate yet (no text, or
       * personalization not offered for this product). `textHeightMm`
       * passed to the validator is the effective minimum
       * (`toPersonalizationSpec`'s stricter-of-spec-and-material floor),
       * not a real layout height - §7.3's 2D preview does not exist yet to
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
    design: PATTERN_FEASIBILITY_ENABLED ? toDesignConstraints(data.design) : null,
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
      productDesign: data.design === null ? null : { surchargeGrosze: data.design.surchargeGrosze },
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
 * Optional by construction (`Selections.personalizationText` is nullable -
 * a customer may buy a piece with no engraved text at all), so "nothing
 * entered yet" is not an issue, it is the default. Once text exists, a font
 * must be chosen before it can be checked at all - `validatePersonalization`
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
  // effective minimum stands in for it - an approximation for the two
  // height-specific checks, exact for the coverage check that matters most.
  const issues = validatePersonalization(
    { text, textHeightMm: domainSpec.minTextHeightMm },
    domainSpec,
    fontSpec,
  );
  return { issues, fontRequired: false };
}

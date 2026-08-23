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
import type { Selections } from '@/domain/configuration/steps';
import {
  toDesignConstraints,
  toDimensionEnvelope,
  toMachineConstraints,
  toMaterialConstraints,
  toPricingInput,
  toSplitLimits,
} from '@/server/mapping/to-domain';
import type {
  DesignRow,
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

  return {
    status: 'priced',
    moduleLayout: layout,
    feasibility,
    blockingError: hasBlockingError(feasibility),
    priceBreakdown,
  };
}

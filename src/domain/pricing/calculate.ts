import type { Grosze } from '../money/money';
import {
  applyFactorsBp,
  divRoundHalfUp,
  grossFor,
  vatFor,
} from '../money/money';
import type {
  MachineRates,
  PriceBreakdown,
  PriceComponents,
  PricingInput,
  ProductionMethod,
} from './types';
import { PricingError } from './types';

const MM2_PER_M2 = 1_000_000;
const MILLI = 1_000;

/**
 * The single source of truth for what a configuration costs.
 *
 * Pure: every rate is passed in, nothing is read from a database, nothing is
 * read from the client. The server calls this at add-to-cart AND again at
 * checkout, and compares. A price that arrives from the browser is only ever
 * used to detect a mismatch, never to charge.
 */
export function calculatePrice(input: PricingInput): PriceBreakdown {
  validate(input);

  const areaMm2 = input.widthMm * input.heightMm;

  const materialGrosze = applyFactorsBp(
    divRoundHalfUp(areaMm2 * input.material.pricePerM2Grosze, MM2_PER_M2),
    [input.material.priceFactorBp, input.thicknessFactorBp],
  );

  // `null` only for CUSTOM (no catalog design) — see PricingInput's
  // comment. Zero, not an estimate: machining time depends on the
  // actual uploaded artwork's complexity, which nothing here can know
  // yet — that is design review's job (§13.3), not a number to guess.
  const machiningGrosze =
    input.design === null
      ? 0
      : machiningCost(areaMm2, input.design.machiningMilliMinutesPerM2, rateFor(input.design.method, input.machineRates));

  const finishGrosze =
    divRoundHalfUp(areaMm2 * input.finish.pricePerM2Grosze, MM2_PER_M2) +
    input.finish.setupFeeGrosze;

  const modulesGrosze =
    Math.max(0, input.modules.count - 1) *
    input.modules.surchargePerExtraModuleGrosze;

  const personalizationGrosze =
    input.personalization.characterCount > 0
      ? input.personalization.flatFeeGrosze +
        input.personalization.characterCount *
          input.personalization.pricePerCharacterGrosze
      : 0;

  const components: PriceComponents = {
    baseGrosze: input.basePriceGrosze,
    materialGrosze,
    machiningGrosze,
    designSurchargeGrosze: input.design === null ? 0 : input.design.surchargeGrosze,
    finishGrosze,
    modulesGrosze,
    personalizationGrosze,
  };

  const componentsSubtotalGrosze =
    components.baseGrosze +
    components.materialGrosze +
    components.machiningGrosze +
    components.designSurchargeGrosze +
    components.finishGrosze +
    components.modulesGrosze +
    components.personalizationGrosze;

  const afterInstallationFactorGrosze = applyFactorsBp(componentsSubtotalGrosze, [
    input.installationFactorBp,
  ]);

  const netBeforeMinimumGrosze =
    afterInstallationFactorGrosze + input.packagingGrosze;

  const minimumApplied = netBeforeMinimumGrosze < input.minPriceGrosze;
  const unitNetGrosze: Grosze = minimumApplied
    ? input.minPriceGrosze
    : netBeforeMinimumGrosze;

  // VAT is computed on the UNIT price and then multiplied, not computed on the
  // line total. The two differ by up to a grosz per line, and invoices use the
  // unit form.
  const unitVatGrosze = vatFor(unitNetGrosze, input.vatRateBp);
  const unitGrossGrosze = grossFor(unitNetGrosze, input.vatRateBp);

  return {
    pricingVersion: input.pricingVersion,
    areaMm2,
    components,
    componentsSubtotalGrosze,
    installationFactorBp: input.installationFactorBp,
    afterInstallationFactorGrosze,
    packagingGrosze: input.packagingGrosze,
    netBeforeMinimumGrosze,
    minimumApplied,
    unitNetGrosze,
    unitVatGrosze,
    unitGrossGrosze,
    vatRateBp: input.vatRateBp,
    quantity: input.quantity,
    lineNetGrosze: unitNetGrosze * input.quantity,
    lineVatGrosze: unitVatGrosze * input.quantity,
    lineGrossGrosze: unitGrossGrosze * input.quantity,
  };
}

/**
 * `MIXED` and `MANUAL_PREP` bill at the CNC rate today.
 *
 * This is a deliberate simplification, not an oversight: neither has a
 * measured rate yet. When real production data exists, give them their own
 * entries in `MachineRates` — the change is local to this function.
 */
export function rateFor(
  method: ProductionMethod,
  rates: MachineRates,
): Grosze {
  switch (method) {
    case 'LASER_ENGRAVE':
      return rates.laserPerMinuteGrosze;
    case 'CNC_CARVE':
    case 'CNC_ENGRAVE':
    case 'MIXED':
    case 'MANUAL_PREP':
      return rates.cncPerMinuteGrosze;
  }
}

function machiningCost(
  areaMm2: number,
  milliMinutesPerM2: number,
  ratePerMinuteGrosze: Grosze,
): Grosze {
  const numerator = areaMm2 * milliMinutesPerM2 * ratePerMinuteGrosze;
  if (!Number.isSafeInteger(numerator)) {
    throw new PricingError(
      'machining cost overflowed the safe integer range; check the rate units',
    );
  }
  return divRoundHalfUp(numerator, MM2_PER_M2 * MILLI);
}

function validate(input: PricingInput): void {
  requirePositiveInteger(input.widthMm, 'widthMm');
  requirePositiveInteger(input.heightMm, 'heightMm');
  requirePositiveInteger(input.quantity, 'quantity');
  requirePositiveInteger(input.modules.count, 'modules.count');

  requireNonNegativeInteger(input.basePriceGrosze, 'basePriceGrosze');
  requireNonNegativeInteger(input.minPriceGrosze, 'minPriceGrosze');
  requireNonNegativeInteger(input.packagingGrosze, 'packagingGrosze');
  requireNonNegativeInteger(input.vatRateBp, 'vatRateBp');
  requireNonNegativeInteger(input.installationFactorBp, 'installationFactorBp');
  requireNonNegativeInteger(input.thicknessFactorBp, 'thicknessFactorBp');
  requireNonNegativeInteger(input.material.priceFactorBp, 'material.priceFactorBp');
  requireNonNegativeInteger(
    input.material.pricePerM2Grosze,
    'material.pricePerM2Grosze',
  );
  if (input.design !== null) {
    requireNonNegativeInteger(
      input.design.machiningMilliMinutesPerM2,
      'design.machiningMilliMinutesPerM2',
    );
    requireNonNegativeInteger(input.design.surchargeGrosze, 'design.surchargeGrosze');
  }
  requireNonNegativeInteger(input.finish.pricePerM2Grosze, 'finish.pricePerM2Grosze');
  requireNonNegativeInteger(input.finish.setupFeeGrosze, 'finish.setupFeeGrosze');
  requireNonNegativeInteger(
    input.modules.surchargePerExtraModuleGrosze,
    'modules.surchargePerExtraModuleGrosze',
  );
  requireNonNegativeInteger(
    input.personalization.characterCount,
    'personalization.characterCount',
  );
  requireNonNegativeInteger(
    input.personalization.flatFeeGrosze,
    'personalization.flatFeeGrosze',
  );
  requireNonNegativeInteger(
    input.personalization.pricePerCharacterGrosze,
    'personalization.pricePerCharacterGrosze',
  );
  requireNonNegativeInteger(
    input.machineRates.cncPerMinuteGrosze,
    'machineRates.cncPerMinuteGrosze',
  );
  requireNonNegativeInteger(
    input.machineRates.laserPerMinuteGrosze,
    'machineRates.laserPerMinuteGrosze',
  );
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PricingError(`${label} must be a positive integer, received ${String(value)}`);
  }
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PricingError(
      `${label} must be a non-negative integer, received ${String(value)}`,
    );
  }
}

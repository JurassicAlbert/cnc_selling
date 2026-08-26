import type { Grosze } from '../money/money';

export type ProductionMethod =
  | 'CNC_CARVE'
  | 'CNC_ENGRAVE'
  | 'LASER_ENGRAVE'
  | 'MIXED'
  | 'MANUAL_PREP';

export type MachineRates = {
  readonly cncPerMinuteGrosze: Grosze;
  readonly laserPerMinuteGrosze: Grosze;
};

export type MaterialPricing = {
  readonly pricePerM2Grosze: Grosze;
  /** Per-product premium for this material. 10000 = x1.00 */
  readonly priceFactorBp: number;
};

export type DesignPricing = {
  /**
   * Machining time in THOUSANDTHS of a minute per m².
   *
   * Integer on purpose: a float here would put floating point back into the
   * price chain that `money` exists to keep out. 2 500 = 2.5 min/m².
   */
  readonly machiningMilliMinutesPerM2: number;
  readonly surchargeGrosze: Grosze;
  readonly method: ProductionMethod;
};

export type FinishPricing = {
  readonly pricePerM2Grosze: Grosze;
  readonly setupFeeGrosze: Grosze;
};

export type ModulePricing = {
  readonly count: number;
  readonly surchargePerExtraModuleGrosze: Grosze;
};

export type PersonalizationPricing = {
  readonly characterCount: number;
  readonly flatFeeGrosze: Grosze;
  readonly pricePerCharacterGrosze: Grosze;
};

export type PricingInput = {
  /** Pins this calculation to a rate set, so an order can always be re-derived. */
  readonly pricingVersion: number;
  readonly basePriceGrosze: Grosze;
  /** Floor below which this product is not sold, whatever the components add up to. */
  readonly minPriceGrosze: Grosze;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly material: MaterialPricing;
  readonly thicknessFactorBp: number;
  /**
   * `null` for a product with no catalog design at all — `CUSTOM`
   * (customer-uploaded artwork, `ARCHITECTURE.md` §13/P4). Machining
   * time and complexity are genuinely unknown until staff reviews the
   * actual upload, so `machiningGrosze`/`designSurchargeGrosze` are both
   * zero rather than an invented estimate — see `calculate.ts`. Every
   * other product type always supplies a real `DesignPricing`.
   */
  readonly design: DesignPricing | null;
  readonly machineRates: MachineRates;
  readonly finish: FinishPricing;
  readonly modules: ModulePricing;
  readonly personalization: PersonalizationPricing;
  /** Kitchen installation variant premium. 10000 = x1.00 */
  readonly installationFactorBp: number;
  readonly packagingGrosze: Grosze;
  readonly vatRateBp: number;
  readonly quantity: number;
};

export type PriceComponents = {
  readonly baseGrosze: Grosze;
  readonly materialGrosze: Grosze;
  readonly machiningGrosze: Grosze;
  readonly designSurchargeGrosze: Grosze;
  readonly finishGrosze: Grosze;
  readonly modulesGrosze: Grosze;
  readonly personalizationGrosze: Grosze;
};

/**
 * The full derivation of a price, stored with the order.
 *
 * Every component is named and in grosze, and they reconcile to the total.
 * This is what makes "why is this 1 340 zł?" answerable a year later.
 */
export type PriceBreakdown = {
  readonly pricingVersion: number;
  readonly areaMm2: number;
  readonly components: PriceComponents;
  readonly componentsSubtotalGrosze: Grosze;
  readonly installationFactorBp: number;
  readonly afterInstallationFactorGrosze: Grosze;
  readonly packagingGrosze: Grosze;
  readonly netBeforeMinimumGrosze: Grosze;
  /** True when the product floor price was higher than the computed price. */
  readonly minimumApplied: boolean;
  readonly unitNetGrosze: Grosze;
  readonly unitVatGrosze: Grosze;
  readonly unitGrossGrosze: Grosze;
  readonly vatRateBp: number;
  readonly quantity: number;
  readonly lineNetGrosze: Grosze;
  readonly lineVatGrosze: Grosze;
  readonly lineGrossGrosze: Grosze;
};

export class PricingError extends Error {
  override name = 'PricingError';
}

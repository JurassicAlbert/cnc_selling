/**
 * Package insurance the customer can select at checkout.
 *
 * Owner request, 2026-09-05, answering BUG-08. Asked how it should be priced -
 * a flat fee, a percentage of the order value, or the carrier's real
 * declared-value table - the owner chose the carrier's real table.
 *
 * **This is therefore a mechanism with no rates in it, on purpose.** InPost
 * and DPD publish declared-value bands to business account holders and neither
 * has a citable public table, the same wall `Kurier GEIS` hit for its weight
 * tiers (`docs/OPEN_ITEMS.md` §2). Seeding a plausible-looking number would
 * break the owner's own instruction that "you are not allowed to lie", so no
 * tier is seeded, `isInsuranceOffered` is false for every method today, and no
 * customer is shown a price. Adding the real bands at `/panel/dostawa` turns
 * it on; nothing in checkout or order creation has to change.
 *
 * Pure, every input a parameter, like the delivery pricing beside it and for
 * the same reason: it decides money.
 */

import type { Grosze } from '@/domain/money/money';

/** One declared-value band from a carrier's own published rate card. */
export type InsuranceTier = {
  readonly labelPl: string;
  /** The highest order value this band covers, inclusive. */
  readonly maxValueGrosze: Grosze;
  readonly priceGrosze: Grosze;
};

/**
 * Does this delivery method offer insurance at all?
 *
 * Derived from whether it has bands rather than stored as a flag, so the
 * answer cannot disagree with the data behind it. The same shape
 * `evaluateDeliveryMethod` uses for weight tiers: an empty table means the
 * feature is not configured, not that it is broken.
 */
export function isInsuranceOffered(tiers: readonly InsuranceTier[]): boolean {
  return tiers.length > 0;
}

/**
 * The band that covers this order, or `null` if none does.
 *
 * Null rather than the highest band when the order is worth more than the
 * table covers. Selling "do 5000 zł" cover on a 6000 zł order would leave the
 * customer believing they are covered when they are not, which is worse than
 * not offering it - the caller hides the option instead.
 *
 * Chosen by ceiling rather than by list order, so a rate card typed into the
 * admin screen out of order still puts a cart in the right band.
 */
export function chooseInsuranceTier(
  tiers: readonly InsuranceTier[],
  declaredValueGrosze: Grosze,
): InsuranceTier | null {
  return (
    [...tiers]
      .sort((a, b) => a.maxValueGrosze - b.maxValueGrosze)
      .find((tier) => declaredValueGrosze <= tier.maxValueGrosze) ?? null
  );
}

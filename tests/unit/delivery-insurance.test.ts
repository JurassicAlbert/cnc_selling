/**
 * `docs/OPEN_ITEMS.md` §10 - package insurance the customer can select.
 *
 * Owner request, 2026-09-05, answering BUG-08. Asked how it should be priced -
 * a flat fee, a percentage of order value, or the carrier's real
 * declared-value table - the owner chose the carrier's real table.
 *
 * **So this is deliberately a mechanism with no rates in it.** InPost and DPD
 * publish declared-value bands to business account holders and neither has a
 * citable public table, which is the same wall `Kurier GEIS` hit for its
 * weight tiers. Seeding a plausible-looking number would break the owner's own
 * instruction that "you are not allowed to lie", so no tier is seeded, no
 * method offers insurance, and the checkbox does not appear anywhere.
 *
 * What is pinned here is therefore the behaviour that has to be right *before*
 * a real rate card arrives, and the behaviour that keeps a half-configured one
 * from quietly charging the wrong thing.
 */

import { describe, expect, it } from 'vitest';

import { chooseInsuranceTier, isInsuranceOffered } from '@/domain/checkout/insurance';
import type { InsuranceTier } from '@/domain/checkout/insurance';

const TIERS: readonly InsuranceTier[] = [
  { labelPl: 'do 500 zł', maxValueGrosze: 50_000, priceGrosze: 500 },
  { labelPl: 'do 2000 zł', maxValueGrosze: 200_000, priceGrosze: 1_200 },
  { labelPl: 'do 5000 zł', maxValueGrosze: 500_000, priceGrosze: 2_500 },
];

describe('isInsuranceOffered', () => {
  it('is false for a method with no tiers - which is every method today', () => {
    // The state the shop actually ships in until a real rate card exists.
    // Nothing in the UI may offer a price that has not been published.
    expect(isInsuranceOffered([])).toBe(false);
  });

  it('is true once a method has a real tier table', () => {
    expect(isInsuranceOffered(TIERS)).toBe(true);
  });
});

describe('chooseInsuranceTier', () => {
  it('picks the cheapest band that covers the declared value', () => {
    expect(chooseInsuranceTier(TIERS, 30_000)).toEqual(TIERS[0]);
    expect(chooseInsuranceTier(TIERS, 150_000)).toEqual(TIERS[1]);
  });

  it('covers a value sitting exactly on a band ceiling with that band', () => {
    // "do 500 zł" has to include 500 zł, or the label is a lie.
    expect(chooseInsuranceTier(TIERS, 50_000)).toEqual(TIERS[0]);
  });

  it('moves up a band one grosz past the ceiling', () => {
    expect(chooseInsuranceTier(TIERS, 50_001)).toEqual(TIERS[1]);
  });

  it('picks by ceiling rather than by list order', () => {
    // A rate card typed into the admin screen out of order must not change
    // which band a cart falls into.
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]] as readonly InsuranceTier[];
    expect(chooseInsuranceTier(shuffled, 30_000)).toEqual(TIERS[0]);
  });

  it('refuses a cart worth more than the highest band rather than insuring it for less', () => {
    // The failure that would matter: quietly selling "do 5000 zł" cover on a
    // 6000 zł order means the customer believes they are covered and is not.
    // Null lets the caller hide the option, which is the honest answer.
    expect(chooseInsuranceTier(TIERS, 600_000)).toBeNull();
  });

  it('offers nothing when there are no tiers', () => {
    expect(chooseInsuranceTier([], 30_000)).toBeNull();
  });
});

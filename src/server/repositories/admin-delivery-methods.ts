/** Admin `DeliveryMethod` queries - unscoped by `isActive`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';

export type AdminDeliveryMethodListItem = {
  readonly id: string;
  readonly namePl: string;
  readonly priceGrosze: number;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function listDeliveryMethodsForAdmin(): Promise<readonly AdminDeliveryMethodListItem[]> {
  return prisma.deliveryMethod.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, namePl: true, priceGrosze: true, isActive: true, sortOrder: true },
  });
}

/** One real published price bracket of a carrier's own rate card - see `DeliveryWeightTier`'s schema comment. */
export type AdminDeliveryWeightTier = {
  readonly id: string;
  readonly labelPl: string;
  readonly maxWeightGrams: number;
  readonly priceGrosze: number;
  readonly maxWidthMm: number | null;
  readonly maxHeightMm: number | null;
  readonly maxDepthMm: number | null;
};

/**
 * One declared-value band of a carrier's own insurance rate card - see
 * `DeliveryInsuranceTier`'s schema comment and INSURANCE-01.
 */
export type AdminDeliveryInsuranceTier = {
  readonly id: string;
  readonly labelPl: string;
  readonly maxValueGrosze: number;
  readonly priceGrosze: number;
};

export type AdminDeliveryMethodDetail = {
  readonly id: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly priceGrosze: number;
  readonly freeShippingThresholdGrosze: number | null;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly carrier: string | null;
  readonly trackingAvailable: boolean;
  readonly requiresPickupPoint: boolean;
  readonly sortOrder: number;
  readonly isActive: boolean;
  /**
   * 2026-08-30 (`docs/AUDIT-2026-08-30.md` §20): these were invisible in the
   * panel, which made the detail page actively misleading - it offered an
   * editable "Cena" while, for any method that has tiers, that field is
   * only the fallback and is never what a customer is charged.
   */
  readonly weightTiers: readonly AdminDeliveryWeightTier[];
  /**
   * INSURANCE-01. Empty for every method today, and that is the feature
   * working as decided rather than a gap: the owner chose the carrier's real
   * declared-value table, neither InPost nor DPD publishes one citably, and
   * inventing plausible bands would be telling a customer they are covered
   * for a figure nobody agreed to. Typing the real card in here turns the
   * option on at checkout; nothing else has to change.
   */
  readonly insuranceTiers: readonly AdminDeliveryInsuranceTier[];
};

const WEIGHT_TIER_SELECT = {
  id: true,
  labelPl: true,
  maxWeightGrams: true,
  priceGrosze: true,
  maxWidthMm: true,
  maxHeightMm: true,
  maxDepthMm: true,
} as const;

const INSURANCE_TIER_SELECT = { id: true, labelPl: true, maxValueGrosze: true, priceGrosze: true } as const;

export async function findDeliveryMethodForAdmin(id: string): Promise<AdminDeliveryMethodDetail | null> {
  return prisma.deliveryMethod.findUnique({
    where: { id },
    select: {
      id: true,
      namePl: true,
      descPl: true,
      priceGrosze: true,
      freeShippingThresholdGrosze: true,
      estimatedDaysMin: true,
      estimatedDaysMax: true,
      carrier: true,
      trackingAvailable: true,
      requiresPickupPoint: true,
      sortOrder: true,
      isActive: true,
      // Ordered by the bracket itself, not by `sortOrder`: a rate card only
      // makes sense read lightest-first, and an admin adding a tier out of
      // order should still see a sane list rather than have to fix it.
      weightTiers: { orderBy: { maxWeightGrams: 'asc' }, select: WEIGHT_TIER_SELECT },
      // Same reasoning as the weight tiers above: a rate card reads
      // cheapest-band-first, so order by the band rather than by `sortOrder`.
      insuranceTiers: { orderBy: { maxValueGrosze: 'asc' }, select: INSURANCE_TIER_SELECT },
    },
  });
}

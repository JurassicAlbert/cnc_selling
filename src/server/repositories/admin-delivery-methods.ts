/** Admin `DeliveryMethod` queries — unscoped by `isActive`. Every caller here MUST go through `requireStaffSession()` first. */

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

/** One real published price bracket of a carrier's own rate card — see `DeliveryWeightTier`'s schema comment. */
export type AdminDeliveryWeightTier = {
  readonly id: string;
  readonly labelPl: string;
  readonly maxWeightGrams: number;
  readonly priceGrosze: number;
  readonly maxWidthMm: number | null;
  readonly maxHeightMm: number | null;
  readonly maxDepthMm: number | null;
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
   * panel, which made the detail page actively misleading — it offered an
   * editable "Cena" while, for any method that has tiers, that field is
   * only the fallback and is never what a customer is charged.
   */
  readonly weightTiers: readonly AdminDeliveryWeightTier[];
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
    },
  });
}

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
  readonly sortOrder: number;
  readonly isActive: boolean;
};

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
      sortOrder: true,
      isActive: true,
    },
  });
}

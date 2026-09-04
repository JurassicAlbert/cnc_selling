/** Admin finish queries - unscoped by `isAvailable`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { FinishKind } from '@/generated/prisma/enums';

export type AdminFinishListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly kind: FinishKind;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
};

export async function listFinishesForAdmin(): Promise<readonly AdminFinishListItem[]> {
  return prisma.finish.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, namePl: true, kind: true, isAvailable: true, sortOrder: true },
  });
}

export type AdminFinishDetail = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly kind: FinishKind;
  readonly descPl: string;
  readonly imageUrl: string;
  readonly pricePerM2Grosze: number;
  readonly setupFeeGrosze: number;
  readonly extraDaysMin: number;
  readonly extraDaysMax: number;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
};

export type AdminFinishOption = { readonly id: string; readonly namePl: string };
export async function listFinishOptionsForAdmin(): Promise<readonly AdminFinishOption[]> {
  return prisma.finish.findMany({ where: { isAvailable: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, namePl: true } });
}

export async function findFinishForAdmin(id: string): Promise<AdminFinishDetail | null> {
  return prisma.finish.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      namePl: true,
      kind: true,
      descPl: true,
      imageUrl: true,
      pricePerM2Grosze: true,
      setupFeeGrosze: true,
      extraDaysMin: true,
      extraDaysMax: true,
      isAvailable: true,
      sortOrder: true,
    },
  });
}

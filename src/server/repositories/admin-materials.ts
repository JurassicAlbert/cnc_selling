/**
 * Admin material queries — unscoped by `isAvailable`, unlike the
 * product-material picker in `admin-products.ts`'s
 * `listMaterialOptionsForAdmin` (which exists only to populate a
 * compatible-material dropdown, not to manage materials themselves).
 * Every caller here MUST go through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';
import type { GrainDirection, MaterialFamily } from '@/generated/prisma/enums';

export type AdminMaterialListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly family: MaterialFamily;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
};

export async function listMaterialsForAdmin(): Promise<readonly AdminMaterialListItem[]> {
  return prisma.material.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, namePl: true, family: true, isAvailable: true, sortOrder: true },
  });
}

export type AdminMaterialFinish = { readonly finishId: string; readonly namePl: string };

export type AdminMaterialDetail = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly family: MaterialFamily;
  readonly shortDescPl: string;
  readonly characteristicsPl: string;
  readonly imageUrl: string;
  readonly pricePerM2Grosze: number;
  readonly densityKgPerM3: number;
  readonly isAvailable: boolean;
  readonly sortOrder: number;
  readonly maxSheetWidthMm: number;
  readonly maxSheetHeightMm: number;
  readonly minLineWidthUm: number;
  readonly minDetailSpacingUm: number;
  readonly minTextHeightUm: number;
  readonly grainDirection: GrainDirection;
  readonly supportsCnc: boolean;
  readonly supportsLaser: boolean;
  readonly isNaturalVariable: boolean;
  readonly finishes: readonly AdminMaterialFinish[];
};

export async function findMaterialForAdmin(id: string): Promise<AdminMaterialDetail | null> {
  const material = await prisma.material.findUnique({
    where: { id },
    include: { finishes: { include: { finish: { select: { namePl: true } } } } },
  });
  if (material === null) {
    return null;
  }
  return {
    id: material.id,
    slug: material.slug,
    namePl: material.namePl,
    family: material.family,
    shortDescPl: material.shortDescPl,
    characteristicsPl: material.characteristicsPl,
    imageUrl: material.imageUrl,
    pricePerM2Grosze: material.pricePerM2Grosze,
    densityKgPerM3: material.densityKgPerM3,
    isAvailable: material.isAvailable,
    sortOrder: material.sortOrder,
    maxSheetWidthMm: material.maxSheetWidthMm,
    maxSheetHeightMm: material.maxSheetHeightMm,
    minLineWidthUm: material.minLineWidthUm,
    minDetailSpacingUm: material.minDetailSpacingUm,
    minTextHeightUm: material.minTextHeightUm,
    grainDirection: material.grainDirection,
    supportsCnc: material.supportsCnc,
    supportsLaser: material.supportsLaser,
    isNaturalVariable: material.isNaturalVariable,
    finishes: material.finishes.map((mf) => ({ finishId: mf.finishId, namePl: mf.finish.namePl })),
  };
}

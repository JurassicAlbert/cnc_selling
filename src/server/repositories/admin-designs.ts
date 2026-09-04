/**
 * Admin design/collection queries - unscoped by `isActive`, unlike
 * `admin-products.ts`'s `listDesignOptionsForAdmin` (active-only, exists
 * only to power the product↔design picker). Every caller here MUST go
 * through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';
import type { DesignRightsStatus, ProductionMethod } from '@/generated/prisma/enums';

// --- Collections ----------------------------------------------------------

export type AdminCollectionListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly designCount: number;
};

export async function listCollectionsForAdmin(): Promise<readonly AdminCollectionListItem[]> {
  const collections = await prisma.designCollection.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, namePl: true, isActive: true, sortOrder: true, _count: { select: { designs: true } } },
  });
  return collections.map((c) => ({
    id: c.id,
    slug: c.slug,
    namePl: c.namePl,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    designCount: c._count.designs,
  }));
}

export type AdminCollectionDetail = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
};

export async function findCollectionForAdmin(id: string): Promise<AdminCollectionDetail | null> {
  return prisma.designCollection.findUnique({
    where: { id },
    select: { id: true, slug: true, namePl: true, descPl: true, sortOrder: true, isActive: true },
  });
}

export type AdminCollectionOption = { readonly id: string; readonly namePl: string };
export async function listCollectionOptionsForAdmin(): Promise<readonly AdminCollectionOption[]> {
  return prisma.designCollection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, namePl: true } });
}

// --- Designs ----------------------------------------------------------------

export type AdminDesignListItem = {
  readonly id: string;
  readonly code: string;
  readonly namePl: string;
  readonly rightsStatus: DesignRightsStatus;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type AdminDesignListFilters = { readonly search?: string };

/** `search` (new, optional) matches `code` or `namePl`, case-insensitive - added for global search; every existing caller passes no filters and is unaffected. */
export async function listDesignsForAdmin(filters: AdminDesignListFilters = {}): Promise<readonly AdminDesignListItem[]> {
  return prisma.design.findMany({
    where:
      filters.search !== undefined && filters.search.length > 0
        ? { OR: [{ code: { contains: filters.search, mode: 'insensitive' } }, { namePl: { contains: filters.search, mode: 'insensitive' } }] }
        : undefined,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, namePl: true, rightsStatus: true, isActive: true, sortOrder: true },
  });
}

export type AdminDesignMaterial = { readonly materialId: string; readonly namePl: string };

export type AdminDesignDetail = {
  readonly id: string;
  readonly slug: string;
  readonly code: string;
  readonly namePl: string;
  readonly descPl: string | null;
  readonly collectionId: string | null;
  readonly tags: readonly string[];
  readonly thumbnailUrl: string;
  readonly previewUrl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly featured: boolean;
  readonly referenceWidthMm: number;
  readonly minLineWidthUm: number;
  readonly minDetailSpacingUm: number;
  readonly minEngraveDepthUm: number | null;
  readonly recommendedMethod: ProductionMethod;
  readonly minRecommendedWidthMm: number;
  readonly maxRecommendedWidthMm: number | null;
  readonly detailLevel: number;
  readonly machiningMilliMinutesPerM2: number;
  readonly rightsStatus: DesignRightsStatus;
  readonly sourceArtist: string | null;
  readonly sourceTitle: string | null;
  readonly sourceYear: number | null;
  readonly artistDeathYear: number | null;
  readonly sourceRef: string | null;
  readonly rightsNotes: string | null;
  readonly materials: readonly AdminDesignMaterial[];
};

export async function findDesignForAdmin(id: string): Promise<AdminDesignDetail | null> {
  const design = await prisma.design.findUnique({
    where: { id },
    include: { materials: { include: { material: { select: { namePl: true } } } } },
  });
  if (design === null) {
    return null;
  }
  return {
    id: design.id,
    slug: design.slug,
    code: design.code,
    namePl: design.namePl,
    descPl: design.descPl,
    collectionId: design.collectionId,
    tags: design.tags,
    thumbnailUrl: design.thumbnailUrl,
    previewUrl: design.previewUrl,
    isActive: design.isActive,
    sortOrder: design.sortOrder,
    featured: design.featured,
    referenceWidthMm: design.referenceWidthMm,
    minLineWidthUm: design.minLineWidthUm,
    minDetailSpacingUm: design.minDetailSpacingUm,
    minEngraveDepthUm: design.minEngraveDepthUm,
    recommendedMethod: design.recommendedMethod,
    minRecommendedWidthMm: design.minRecommendedWidthMm,
    maxRecommendedWidthMm: design.maxRecommendedWidthMm,
    detailLevel: design.detailLevel,
    machiningMilliMinutesPerM2: design.machiningMilliMinutesPerM2,
    rightsStatus: design.rightsStatus,
    sourceArtist: design.sourceArtist,
    sourceTitle: design.sourceTitle,
    sourceYear: design.sourceYear,
    artistDeathYear: design.artistDeathYear,
    sourceRef: design.sourceRef,
    rightsNotes: design.rightsNotes,
    materials: design.materials.map((dm) => ({ materialId: dm.materialId, namePl: dm.material.namePl })),
  };
}

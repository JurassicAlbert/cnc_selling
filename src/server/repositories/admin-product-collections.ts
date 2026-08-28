/**
 * Admin `ProductCollection` queries — unscoped by `isActive`, unlike the
 * real public read. Every caller here MUST go through `requireStaffSession()`
 * first. Deliberately a separate model/file from `DesignCollection`
 * (`admin-designs.ts`'s `AdminCollection*` exports) — that groups patterns,
 * this groups sellable, independently-created products (P9 phase 4).
 */

import { prisma } from '@/server/db/client';

export type AdminProductCollectionListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly productCount: number;
};

export async function listProductCollectionsForAdmin(): Promise<readonly AdminProductCollectionListItem[]> {
  const collections = await prisma.productCollection.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, namePl: true, isActive: true, sortOrder: true, _count: { select: { items: true } } },
  });
  return collections.map((c) => ({
    id: c.id,
    slug: c.slug,
    namePl: c.namePl,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    productCount: c._count.items,
  }));
}

export type AdminProductCollectionDetail = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
};

export async function findProductCollectionForAdmin(id: string): Promise<AdminProductCollectionDetail | null> {
  return prisma.productCollection.findUnique({
    where: { id },
    select: { id: true, slug: true, namePl: true, descPl: true, imageUrl: true, sortOrder: true, isActive: true },
  });
}

export type AdminProductCollectionItem = { readonly productId: string; readonly namePl: string; readonly slug: string; readonly sortOrder: number };

export async function listProductCollectionItemsForAdmin(collectionId: string): Promise<readonly AdminProductCollectionItem[]> {
  const items = await prisma.productCollectionItem.findMany({
    where: { collectionId },
    orderBy: { sortOrder: 'asc' },
    select: { productId: true, sortOrder: true, product: { select: { namePl: true, slug: true } } },
  });
  return items.map((item) => ({ productId: item.productId, namePl: item.product.namePl, slug: item.product.slug, sortOrder: item.sortOrder }));
}

export type AdminProductOption = { readonly id: string; readonly namePl: string; readonly slug: string };

/** Every active product, for the collection↔product assignment picker. */
export async function listProductOptionsForAdmin(): Promise<readonly AdminProductOption[]> {
  return prisma.product.findMany({ where: { isActive: true }, orderBy: { namePl: 'asc' }, select: { id: true, namePl: true, slug: true } });
}

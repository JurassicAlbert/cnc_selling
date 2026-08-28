import { prisma } from '@/server/db/client';
import type { ProductCardData } from '@/server/repositories/products';

/**
 * Public `ProductCollection` reads — P9 phase 4. Curated groupings of
 * ready-made, independently-created products, explicitly distinct from a
 * `Category` (a product still belongs to exactly one category regardless
 * of collection membership) and from `DesignCollection` (patterns, not
 * products).
 */

export type CollectionListItem = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
};

export async function listActiveCollections(): Promise<readonly CollectionListItem[]> {
  return prisma.productCollection.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
}

export type CollectionDetail = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

export async function getActiveCollectionBySlug(slug: string): Promise<CollectionDetail | null> {
  const collection = await prisma.productCollection.findFirst({
    where: { slug, isActive: true },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
  if (collection === null) {
    return null;
  }
  return { ...collection, seoTitlePl: `${collection.namePl} — RYT`, seoDescPl: collection.descPl };
}

/** Only active products, in the collection's own curated order — same card shape `ProductCard` already renders for a category. Same `category.isActive` cascade as `products.ts`. */
export async function listActiveProductsByCollectionSlug(collectionSlug: string): Promise<ProductCardData[]> {
  const items = await prisma.productCollectionItem.findMany({
    where: {
      collection: { slug: collectionSlug, isActive: true },
      product: { isActive: true, category: { isActive: true } },
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      product: {
        select: {
          slug: true,
          namePl: true,
          shortDescPl: true,
          minPriceGrosze: true,
          category: { select: { namePl: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          personalization: { select: { isEnabled: true } },
          productionDaysMin: true,
          productionDaysMax: true,
          minWidthMm: true,
          maxWidthMm: true,
          materials: { select: { material: { select: { namePl: true } } } },
        },
      },
    },
  });

  return items.map(({ product }) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    minPriceGrosze: product.minPriceGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
    categoryNamePl: product.category.namePl,
    categorySlug: product.category.slug,
    hasPersonalization: product.personalization?.isEnabled ?? false,
    productionDaysMin: product.productionDaysMin,
    productionDaysMax: product.productionDaysMax,
    minWidthMm: product.minWidthMm,
    maxWidthMm: product.maxWidthMm,
    materials: product.materials.map((m) => ({ namePl: m.material.namePl })),
  }));
}

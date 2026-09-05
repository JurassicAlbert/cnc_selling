import { cache } from 'react';

import { prisma } from '@/server/db/client';
import type { ProductCardData } from '@/server/repositories/products';

/**
 * Public `ProductCollection` reads - P9 phase 4. Curated groupings of
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

/**
 * The uncached query behind `listActiveCollections`.
 *
 * Exported for tests, and named so the choice is deliberate at every call
 * site. Application code should use the memoized wrapper below; an
 * integration test wants the raw query, because `cache()` outside a real
 * request has no defined scope to memoize against and asserting through it
 * would be asserting React's behaviour rather than this project's.
 */
export async function queryActiveCollections(): Promise<readonly CollectionListItem[]> {
  return prisma.productCollection.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
}

/**
 * Request-scoped memoization, **not** a cross-request cache.
 *
 * `StorefrontChrome` builds the "Kolekcje" dropdown from it on every storefront page.
 * `cache()` collapses those to one query per request and cannot go stale:
 * it lives and dies with the request, so an admin edit is visible on the
 * very next one.
 *
 * PERF-01 step 1 proposed going further - `unstable_cache` with a tag,
 * invalidated from the admin operations. That was built and then backed out,
 * and the reason is worth recording rather than re-attempting blind: the
 * caching half demonstrably works (a category added straight to the database
 * stayed invisible until the TTL passed), but **the invalidation half was
 * never verified end to end**. Next 16 documents cache tagging for `fetch`
 * and `use cache` and does not mention `unstable_cache` at all. Shipping a
 * cross-request cache whose invalidation is unproven means an admin edit
 * that silently takes minutes to appear - the wrong thing to guess about, so
 * it waits for the `cacheComponents` decision that unblocks `use cache`
 * (`docs/REVIEW-PERFORMANCE.md` Finding 1).
 */
export const listActiveCollections = cache(queryActiveCollections);

export type CollectionDetail = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

async function queryActiveCollectionBySlug(slug: string): Promise<CollectionDetail | null> {
  const collection = await prisma.productCollection.findFirst({
    where: { slug, isActive: true },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
  if (collection === null) {
    return null;
  }
  return { ...collection, seoTitlePl: `${collection.namePl} - RYT`, seoDescPl: collection.descPl };
}

/**
 * Request-scoped memoization - `docs/REVIEW-DETAILED.md` PERF-02. This page's
 * `generateMetadata` and its body both call `getActiveCollectionBySlug`, and Next
 * deduplicates `fetch`, not Prisma, so the identical query ran twice per
 * render. `cache()` lasts exactly one request, so there is no staleness to
 * reason about - an admin edit shows on the next request either way.
 */
export const getActiveCollectionBySlug = cache(queryActiveCollectionBySlug);

/** Only active products, in the collection's own curated order - same card shape `ProductCard` already renders for a category. Same `category.isActive` cascade as `products.ts`. */
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
          startingPriceGrossGrosze: true,
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
    startingPriceGrossGrosze: product.startingPriceGrossGrosze,
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

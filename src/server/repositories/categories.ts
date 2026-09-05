import { cache } from 'react';

import { prisma } from '@/server/db/client';

export type CategorySummary = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
};

/** Active categories, in the order they should be presented. */
/**
 * The uncached query behind `listActiveCategories`.
 *
 * Exported for tests, and named so the choice is deliberate at every call
 * site. Application code should use the memoized wrapper below; an
 * integration test wants the raw query, because `cache()` outside a real
 * request has no defined scope to memoize against and asserting through it
 * would be asserting React's behaviour rather than this project's.
 */
export async function queryActiveCategories(): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
  return categories;
}

/**
 * Request-scoped memoization, **not** a cross-request cache.
 *
 * `StorefrontChrome` and the homepage category grid both call this on one render.
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
export const listActiveCategories = cache(queryActiveCategories);

export type CategoryDetail = CategorySummary & {
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

async function queryActiveCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
  return prisma.category.findFirst({
    where: { slug, isActive: true },
    select: {
      slug: true,
      namePl: true,
      descPl: true,
      imageUrl: true,
      seoTitlePl: true,
      seoDescPl: true,
    },
  });
}

/**
 * Request-scoped memoization - `docs/REVIEW-DETAILED.md` PERF-02. This page's
 * `generateMetadata` and its body both call `getActiveCategoryBySlug`, and Next
 * deduplicates `fetch`, not Prisma, so the identical query ran twice per
 * render. `cache()` lasts exactly one request, so there is no staleness to
 * reason about - an admin edit shows on the next request either way.
 */
export const getActiveCategoryBySlug = cache(queryActiveCategoryBySlug);

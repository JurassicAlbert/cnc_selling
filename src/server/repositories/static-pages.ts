import { cache } from 'react';

import { prisma } from '@/server/db/client';

export type StaticPageView = {
  readonly titlePl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

/** Real public static-page read - active only. */
async function queryActiveStaticPageBySlug(slug: string): Promise<StaticPageView | null> {
  return prisma.staticPage.findFirst({
    where: { slug, isActive: true },
    select: { titlePl: true, bodyPl: true, seoTitlePl: true, seoDescPl: true },
  });
}

/**
 * Request-scoped memoization - `docs/REVIEW-DETAILED.md` PERF-02. This page's
 * `generateMetadata` and its body both call `getActiveStaticPageBySlug`, and Next
 * deduplicates `fetch`, not Prisma, so the identical query ran twice per
 * render. `cache()` lasts exactly one request, so there is no staleness to
 * reason about - an admin edit shows on the next request either way.
 */
export const getActiveStaticPageBySlug = cache(queryActiveStaticPageBySlug);

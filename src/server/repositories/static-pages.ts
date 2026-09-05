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

/**
 * Every admin-authored page a visitor can reach - `docs/AI-CHECKLIST.md`
 * BUG-16.
 *
 * Deliberately not `cache`d, unlike the read above: this has exactly one
 * caller, the sitemap, which runs it once per request. Memoizing a query
 * that is never repeated within a request buys nothing and adds a lifetime
 * to reason about.
 *
 * `isActive` is the whole point. `/strony/[slug]` 404s for an inactive page,
 * so advertising one would send a crawler to a dead end.
 */
export async function listAllActiveStaticPageSlugs(): Promise<string[]> {
  const pages = await prisma.staticPage.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return pages.map((page) => page.slug);
}

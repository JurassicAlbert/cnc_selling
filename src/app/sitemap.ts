import type { MetadataRoute } from 'next';

import { listAllPublishedBlogPostSlugs } from '@/server/repositories/blog';
import { listActiveCategories } from '@/server/repositories/categories';
import { listActiveCollections } from '@/server/repositories/collections';
import { listAllActiveProductSlugs } from '@/server/repositories/products';
import { listAllActiveStaticPageSlugs } from '@/server/repositories/static-pages';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Every public page, changing rarely enough to be worth naming by hand.
 *
 * `docs/AI-CHECKLIST.md` BUG-16: the sitemap listed the home page, `/blog`,
 * the categories, the products and the posts, and nothing else - so
 * `/kolekcje`, the two legal pages and the three marketing pages were
 * invisible to a crawler that had not found them by following links.
 *
 * Deliberately a list rather than a filesystem scan. `/szukaj` is a real
 * route and must not be here (it sets `index: false`, and a sitemap that
 * contradicts the page is worse than one that omits it); `/wzory` is a real
 * route that currently calls `notFound()` while pattern selection is off;
 * `/koszyk`, `/moje-konto`, `/panel` and `/zamowienie/*` are private. A scan
 * would list all of them and every guard against that would be a filter as
 * hand-maintained as this list, minus the ability to say why.
 */
const FIXED_PAGES: readonly (readonly [string, MetadataRoute.Sitemap[number]['changeFrequency']])[] = [
  ['', 'daily'],
  ['/blog', 'weekly'],
  ['/kolekcje', 'weekly'],
  ['/faq', 'monthly'],
  ['/o-nas', 'monthly'],
  ['/kontakt', 'monthly'],
  // Legal pages change rarely and are genuinely searched for by name.
  ['/regulamin', 'yearly'],
  ['/polityka-prywatnosci', 'yearly'],
];

/** Generated from the DB (ARCHITECTURE.md §18) - never a hand-maintained list. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, collections, productSlugs, blogSlugs, staticPageSlugs] = await Promise.all([
    listActiveCategories(),
    listActiveCollections(),
    listAllActiveProductSlugs(),
    listAllPublishedBlogPostSlugs(),
    listAllActiveStaticPageSlugs(),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/${category.slug}`,
    changeFrequency: 'weekly',
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((collection) => ({
    url: `${SITE_URL}/kolekcje/${collection.slug}`,
    changeFrequency: 'weekly',
  }));

  const productEntries: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: `${SITE_URL}/produkt/${slug}`,
    changeFrequency: 'weekly',
  }));

  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    changeFrequency: 'monthly',
  }));

  /*
    The pages an admin can create without touching the code, which makes them
    exactly the ones nobody would remember to add by hand.

    Minus any whose slug is already a first-class route. `/o-nas` is a
    hand-built marketing page **and** `o-nas` is a seeded `StaticPage`, so
    `/strony/o-nas` renders a second, different page under the same „O nas -
    RYT" title - found on 2026-09-05 by reading the generated sitemap rather
    than the code, and latent until this change was about to advertise both.

    A crawler offered two URLs for one page has to pick, and it may not pick
    the one the shop would. Whether the duplicate should exist at all is the
    owner's call and is recorded separately; that a sitemap must not publish
    both is not.
  */
  const fixedPaths = new Set(FIXED_PAGES.map(([path]) => path));
  const staticPageEntries: MetadataRoute.Sitemap = staticPageSlugs
    .filter((slug) => !fixedPaths.has(`/${slug}`))
    .map((slug) => ({
      url: `${SITE_URL}/strony/${slug}`,
      changeFrequency: 'monthly',
    }));

  return [
    ...FIXED_PAGES.map(([path, changeFrequency]) => ({ url: `${SITE_URL}${path}`, changeFrequency })),
    ...categoryEntries,
    ...collectionEntries,
    ...productEntries,
    ...blogEntries,
    ...staticPageEntries,
  ];
}

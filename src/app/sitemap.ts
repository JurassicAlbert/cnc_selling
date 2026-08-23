import type { MetadataRoute } from 'next';

import { listActiveCategories } from '@/server/repositories/categories';
import { listAllActiveProductSlugs } from '@/server/repositories/products';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Generated from the DB (ARCHITECTURE.md §18) — never a hand-maintained list. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, productSlugs] = await Promise.all([
    listActiveCategories(),
    listAllActiveProductSlugs(),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/${category.slug}`,
    changeFrequency: 'weekly',
  }));

  const productEntries: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: `${SITE_URL}/produkt/${slug}`,
    changeFrequency: 'weekly',
  }));

  return [{ url: SITE_URL, changeFrequency: 'daily' }, ...categoryEntries, ...productEntries];
}

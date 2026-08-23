import { prisma } from '@/server/db/client';

export type CategorySummary = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string | null;
};

/** Active categories, in the order they should be presented. */
export async function listActiveCategories(): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, namePl: true, descPl: true, imageUrl: true },
  });
  return categories;
}

export type CategoryDetail = CategorySummary & {
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

export async function getActiveCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
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

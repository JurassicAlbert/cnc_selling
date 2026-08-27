/**
 * Admin category queries — unlike `repositories/categories.ts`'s
 * `listActiveCategories`/`getActiveCategoryBySlug`, these are unscoped by
 * `isActive` (staff needs to see and re-activate a deactivated category
 * too). Every caller here MUST go through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';

export type AdminCategoryListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly productCount: number;
};

export async function listCategoriesForAdmin(): Promise<readonly AdminCategoryListItem[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      slug: true,
      namePl: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { products: true } },
    },
  });
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    namePl: category.namePl,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    productCount: category._count.products,
  }));
}

export type AdminCategoryDetail = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
};

export async function findCategoryForAdmin(id: string): Promise<AdminCategoryDetail | null> {
  return prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      namePl: true,
      descPl: true,
      seoTitlePl: true,
      seoDescPl: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
    },
  });
}

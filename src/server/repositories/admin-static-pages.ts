/** Admin static-page queries — unscoped by `isActive`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';

export type AdminStaticPageListItem = {
  readonly id: string;
  readonly slug: string;
  readonly titlePl: string;
  readonly isActive: boolean;
};

export async function listStaticPagesForAdmin(): Promise<readonly AdminStaticPageListItem[]> {
  return prisma.staticPage.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, titlePl: true, isActive: true },
  });
}

export type AdminStaticPageDetail = {
  readonly id: string;
  readonly slug: string;
  readonly titlePl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function findStaticPageForAdmin(id: string): Promise<AdminStaticPageDetail | null> {
  return prisma.staticPage.findUnique({
    where: { id },
    select: { id: true, slug: true, titlePl: true, bodyPl: true, seoTitlePl: true, seoDescPl: true, isActive: true, sortOrder: true },
  });
}

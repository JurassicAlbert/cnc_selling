import { prisma } from '@/server/db/client';

export type StaticPageView = {
  readonly titlePl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

/** Real public static-page read — active only. */
export async function getActiveStaticPageBySlug(slug: string): Promise<StaticPageView | null> {
  return prisma.staticPage.findFirst({
    where: { slug, isActive: true },
    select: { titlePl: true, bodyPl: true, seoTitlePl: true, seoDescPl: true },
  });
}

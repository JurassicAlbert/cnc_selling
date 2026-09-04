import { prisma } from '@/server/db/client';

export type FaqEntry = { readonly id: string; readonly questionPl: string; readonly answerPl: string };

/** Real public FAQ page - active entries only. */
export async function listActiveFaqs(): Promise<readonly FaqEntry[]> {
  return prisma.faq.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, questionPl: true, answerPl: true },
  });
}

/** The homepage teaser - same query, just capped. */
export async function listFaqTeaser(limit: number): Promise<readonly FaqEntry[]> {
  return prisma.faq.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: limit,
    select: { id: true, questionPl: true, answerPl: true },
  });
}

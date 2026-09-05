/** Admin FAQ queries - unscoped by `isActive`, unlike the real public `/faq` read. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';

export type AdminFaqListItem = {
  readonly id: string;
  readonly questionPl: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function listFaqsForAdmin(): Promise<readonly AdminFaqListItem[]> {
  return prisma.faq.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, questionPl: true, isActive: true, sortOrder: true },
  });
}

export type AdminFaqDetail = {
  readonly id: string;
  readonly questionPl: string;
  readonly answerPl: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
};

export async function findFaqForAdmin(id: string): Promise<AdminFaqDetail | null> {
  return prisma.faq.findUnique({
    where: { id },
    select: { id: true, questionPl: true, answerPl: true, sortOrder: true, isActive: true },
  });
}

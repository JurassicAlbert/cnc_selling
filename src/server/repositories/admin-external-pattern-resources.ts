/** Admin external-pattern-resource queries — unscoped by `isActive`, unlike the real public read. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';

export type AdminExternalPatternResourceListItem = {
  readonly id: string;
  readonly namePl: string;
  readonly sourceLabel: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function listExternalPatternResourcesForAdmin(): Promise<readonly AdminExternalPatternResourceListItem[]> {
  return prisma.externalPatternResource.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, namePl: true, sourceLabel: true, isActive: true, sortOrder: true },
  });
}

export type AdminExternalPatternResourceDetail = {
  readonly id: string;
  readonly namePl: string;
  readonly url: string;
  readonly descPl: string | null;
  readonly sourceLabel: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
};

export async function findExternalPatternResourceForAdmin(id: string): Promise<AdminExternalPatternResourceDetail | null> {
  return prisma.externalPatternResource.findUnique({
    where: { id },
    select: { id: true, namePl: true, url: true, descPl: true, sourceLabel: true, sortOrder: true, isActive: true },
  });
}

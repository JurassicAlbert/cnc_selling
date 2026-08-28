import { prisma } from '@/server/db/client';

export type ExternalPatternResourceEntry = {
  readonly id: string;
  readonly namePl: string;
  readonly url: string;
  readonly descPl: string | null;
  readonly sourceLabel: string;
};

/** Real public pattern-resources section — active entries only. P9 phase 3: never presented as this project's own content. */
export async function listActiveExternalPatternResources(): Promise<readonly ExternalPatternResourceEntry[]> {
  return prisma.externalPatternResource.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, namePl: true, url: true, descPl: true, sourceLabel: true },
  });
}

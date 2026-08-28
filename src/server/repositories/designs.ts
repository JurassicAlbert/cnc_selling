import { prisma } from '@/server/db/client';

/**
 * Public pattern-browsing repository. P9 phase 3: `Design.featured` (added
 * in phase 2) finally has a real consumer here — featured designs sort
 * first, everything else falls back to `sortOrder`. Only rights-clear
 * designs are shown, mirroring the same `rightsStatus` filter the
 * configurator's own design picker already enforces (§12) — a design still
 * pending permission is never shown as if it were sellable/usable.
 */

export type PublicDesignListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string | null;
  readonly thumbnailUrl: string;
  readonly tags: readonly string[];
  readonly featured: boolean;
};

export async function listActiveDesignsForBrowsing(): Promise<readonly PublicDesignListItem[]> {
  const designs = await prisma.design.findMany({
    where: { isActive: true, rightsStatus: { in: ['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN'] } },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
    select: { id: true, slug: true, namePl: true, descPl: true, thumbnailUrl: true, tags: true, featured: true },
  });
  return designs;
}

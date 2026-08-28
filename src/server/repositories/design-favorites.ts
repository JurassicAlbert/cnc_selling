/**
 * P9 continuation, 2026-08-28 — "wzory, które dodał do ulubionych" (owner
 * feedback). Login-only: `DesignFavorite` has no guest `sessionToken` half
 * (see `schema.prisma`'s own comment on the model), so every function here
 * takes a `userId` directly rather than the `Owner` shape `customer-
 * designs.ts`/`design-review.ts` use for guest-or-account ownership.
 */

import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';

export type FavoriteDesignListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly thumbnailUrl: string;
};

export async function listFavoriteDesigns(userId: string): Promise<readonly FavoriteDesignListItem[]> {
  const favorites = await prisma.designFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { design: { select: { id: true, slug: true, namePl: true, thumbnailUrl: true } } },
  });
  return favorites.map((f) => f.design);
}

export async function listMyFavoriteDesigns(): Promise<readonly FavoriteDesignListItem[]> {
  const session = await getSession();
  if (session === null) {
    return [];
  }
  return listFavoriteDesigns(session.userId);
}

/** For `/wzory`'s card-level heart toggle — which of the given design ids the logged-in user has already favourited. Empty set for a guest, never an error. */
export async function listFavoritedDesignIds(userId: string | null, designIds: readonly string[]): Promise<ReadonlySet<string>> {
  if (userId === null || designIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.designFavorite.findMany({
    where: { userId, designId: { in: [...designIds] } },
    select: { designId: true },
  });
  return new Set(rows.map((r) => r.designId));
}

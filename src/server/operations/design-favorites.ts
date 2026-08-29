/**
 * P9 continuation, 2026-08-28 — "wzory, które dodał do ulubionych" (owner
 * feedback). `applyToggleFavoriteDesign` takes the userId explicitly
 * (testable); `toggleFavoriteDesign` derives it from the real session —
 * same `applyXxx`/`xxx` split as every other mutation in this codebase.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';

export type ToggleFavoriteDesignResult =
  | { readonly ok: true; readonly favorited: boolean }
  | { readonly ok: false; readonly code: 'NOT_LOGGED_IN' | 'DESIGN_NOT_FOUND' };

export async function applyToggleFavoriteDesign(userId: string, designId: string): Promise<ToggleFavoriteDesignResult> {
  const design = await prisma.design.findUnique({ where: { id: designId }, select: { id: true } });
  if (design === null) {
    return { ok: false, code: 'DESIGN_NOT_FOUND' };
  }
  const existing = await prisma.designFavorite.findUnique({ where: { userId_designId: { userId, designId } } });
  if (existing !== null) {
    await prisma.designFavorite.delete({ where: { userId_designId: { userId, designId } } });
    return { ok: true, favorited: false };
  }
  await prisma.designFavorite.create({ data: { userId, designId } });
  return { ok: true, favorited: true };
}

export async function toggleFavoriteDesign(designId: string): Promise<ToggleFavoriteDesignResult> {
  const session = await getSession();
  if (session === null) {
    return { ok: false, code: 'NOT_LOGGED_IN' };
  }
  const result = await applyToggleFavoriteDesign(session.userId, designId);
  if (result.ok) {
    revalidatePath('/wzory');
    revalidatePath('/moje-konto');
  }
  return result;
}

/**
 * Customer-facing review reads. Ownership re-verification for the actual
 * submission lives in `actions/reviews.ts` (never trusted from a page that
 * merely displays a link) — these are the lighter, display-only reads used
 * once a page has already established ownership of the order some other
 * way (`findOrderForConfirmation`/`findOrderForUser`, both in
 * `repositories/orders.ts`).
 */

import { prisma } from '@/server/db/client';
import type { ReviewStatus } from '@/generated/prisma/enums';

/** Whether `orderNumber` already has a review, for showing "already submitted" instead of the form — existence only, no ownership check (the caller already proved ownership to get here). */
export async function findReviewStatusForOrder(orderNumber: string): Promise<ReviewStatus | null> {
  const review = await prisma.review.findFirst({ where: { order: { orderNumber } }, select: { status: true } });
  return review?.status ?? null;
}

export type PublicReview = { readonly authorNamePl: string; readonly rating: number; readonly bodyPl: string };

/** Homepage reviews section — approved only, real submissions never fabricated (§16A.1 module 9). */
export async function listApprovedReviews(limit: number): Promise<readonly PublicReview[]> {
  return prisma.review.findMany({
    where: { status: 'APPROVED' },
    orderBy: { moderatedAt: 'desc' },
    take: limit,
    select: { authorNamePl: true, rating: true, bodyPl: true },
  });
}

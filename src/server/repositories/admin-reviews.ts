/** Admin review queries - every status, not just `APPROVED`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { ReviewStatus } from '@/generated/prisma/enums';

export type AdminReviewListItem = {
  readonly id: string;
  readonly orderNumber: string;
  readonly authorNamePl: string;
  readonly rating: number;
  readonly bodyPl: string;
  readonly status: ReviewStatus;
  readonly createdAt: Date;
};

export async function listReviewsForAdmin(status?: ReviewStatus): Promise<readonly AdminReviewListItem[]> {
  const reviews = await prisma.review.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    select: { id: true, authorNamePl: true, rating: true, bodyPl: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
  });
  return reviews.map((review) => ({
    id: review.id,
    orderNumber: review.order.orderNumber,
    authorNamePl: review.authorNamePl,
    rating: review.rating,
    bodyPl: review.bodyPl,
    status: review.status,
    createdAt: review.createdAt,
  }));
}

/** Admin review queries - every status, not just `APPROVED`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { PageRequest } from '@/domain/pagination/page';
import type { Page } from '@/server/repositories/page';
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

/**
 * PERF-03. This returned the whole table in one payload. It is a record
 * customers create rather than a catalogue staff curate, so nobody decides
 * how many rows there are - which is the distinction the item draws with
 * "reuse ADMIN-01's pagination helper **as they grow**; do not pre-optimise
 * all 22".
 *
 * One shared `where` for both halves, as in `listOrdersForAdmin`: a count
 * built from a separately-written filter is how a list ends up offering
 * pages of a result that has none of them.
 */
export async function listReviewsForAdmin(
  status: ReviewStatus | undefined,
  page: Pick<PageRequest, 'skip' | 'take'>,
): Promise<Page<AdminReviewListItem>> {
  const where = { status };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
      select: { id: true, authorNamePl: true, rating: true, bodyPl: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items: reviews.map((review) => ({
      id: review.id,
      orderNumber: review.order.orderNumber,
      authorNamePl: review.authorNamePl,
      rating: review.rating,
      bodyPl: review.bodyPl,
      status: review.status,
      createdAt: review.createdAt,
    })),
    total,
  };
}

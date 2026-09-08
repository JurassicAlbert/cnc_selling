/**
 * Admin design-review queue - unscoped by owner, unlike
 * `repositories/design-review.ts`'s `Owned*` functions. Every caller here
 * MUST go through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';
import type { PageRequest } from '@/domain/pagination/page';
import type { Page } from '@/server/repositories/page';
import type { DesignReviewStatus, ProductionMethod } from '@/generated/prisma/enums';
import type { UploadWarning } from '@/domain/upload/inspect';

export type PendingDesignReviewItem = {
  readonly id: string;
  readonly originalName: string;
  readonly createdAt: Date;
  readonly customerLabel: string;
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
export async function listPendingDesignReviews(
  page: Pick<PageRequest, 'skip' | 'take'>,
): Promise<Page<PendingDesignReviewItem>> {
  const where = { status: 'PENDING_REVIEW' as const };

  const [designs, total] = await Promise.all([
    prisma.customerDesign.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        createdAt: true,
        file: { select: { originalName: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.customerDesign.count({ where }),
  ]);

  return {
    items: designs.map((design) => ({
      id: design.id,
      originalName: design.file.originalName,
      createdAt: design.createdAt,
      customerLabel: design.user?.email ?? 'gość',
    })),
    total,
  };
}

export type AdminDesignReviewComment = {
  readonly id: string;
  readonly authorType: string;
  readonly bodyPl: string;
  readonly createdAt: Date;
};

export type AdminDesignReviewView = {
  readonly id: string;
  readonly status: DesignReviewStatus;
  readonly productionMethod: ProductionMethod | null;
  /**
   * `null` means the automatic check has not run yet - BUG-11. It only runs
   * once a target size exists, which is at add-to-cart, so a design uploaded
   * and never configured has never been assessed. Collapsing that to `[]`
   * told staff „Brak ostrzeżeń." about a check that never happened.
   */
  readonly autoWarnings: readonly UploadWarning[] | null;
  readonly fileId: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly comments: readonly AdminDesignReviewComment[];
  /**
   * BUG-15: every file this design had before the current one, newest first.
   *
   * Staff-only by construction - `findOwnedUploadedFile` refuses a superseded
   * file to the customer, and this is the only place they are listed. Empty
   * for a design nobody has re-uploaded, which is most of them.
   */
  readonly previousFiles: readonly AdminDesignReviewPreviousFile[];
};

export type AdminDesignReviewPreviousFile = {
  readonly fileId: string;
  readonly originalName: string;
  readonly supersededAt: Date;
};

export async function findDesignReviewForAdmin(designId: string): Promise<AdminDesignReviewView | null> {
  const design = await prisma.customerDesign.findUnique({
    where: { id: designId },
    select: {
      id: true,
      status: true,
      productionMethod: true,
      autoWarnings: true,
      fileId: true,
      file: { select: { originalName: true, mimeType: true } },
      reviewComments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorType: true, bodyPl: true, createdAt: true },
      },
      // BUG-15. Newest first: the most recent thing the customer replaced is
      // the one a reviewer is most likely to be comparing against.
      supersededUploads: {
        orderBy: { supersededAt: 'desc' },
        select: { id: true, originalName: true, supersededAt: true },
      },
    },
  });
  if (design === null) {
    return null;
  }
  return {
    id: design.id,
    status: design.status,
    productionMethod: design.productionMethod,
    autoWarnings: design.autoWarnings as unknown as UploadWarning[] | null,
    previousFiles: design.supersededUploads.flatMap((file) =>
      // `supersededAt` is nullable in the schema and never null for a row that
      // reached this relation. Narrowed rather than asserted, so a future
      // write that forgets the timestamp drops the row instead of rendering
      // "Invalid Date" at a reviewer.
      file.supersededAt === null
        ? []
        : [{ fileId: file.id, originalName: file.originalName, supersededAt: file.supersededAt }],
    ),
    fileId: design.fileId,
    originalName: design.file.originalName,
    mimeType: design.file.mimeType,
    comments: design.reviewComments,
  };
}

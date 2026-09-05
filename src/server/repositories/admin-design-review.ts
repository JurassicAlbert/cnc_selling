/**
 * Admin design-review queue - unscoped by owner, unlike
 * `repositories/design-review.ts`'s `Owned*` functions. Every caller here
 * MUST go through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';
import type { DesignReviewStatus, ProductionMethod } from '@/generated/prisma/enums';
import type { UploadWarning } from '@/domain/upload/inspect';

export type PendingDesignReviewItem = {
  readonly id: string;
  readonly originalName: string;
  readonly createdAt: Date;
  readonly customerLabel: string;
};

export async function listPendingDesignReviews(): Promise<readonly PendingDesignReviewItem[]> {
  const designs = await prisma.customerDesign.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      file: { select: { originalName: true } },
      user: { select: { email: true } },
    },
  });
  return designs.map((design) => ({
    id: design.id,
    originalName: design.file.originalName,
    createdAt: design.createdAt,
    customerLabel: design.user?.email ?? 'gość',
  }));
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
  readonly autoWarnings: readonly UploadWarning[];
  readonly fileId: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly comments: readonly AdminDesignReviewComment[];
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
    },
  });
  if (design === null) {
    return null;
  }
  return {
    id: design.id,
    status: design.status,
    productionMethod: design.productionMethod,
    autoWarnings: (design.autoWarnings as unknown as UploadWarning[] | null) ?? [],
    fileId: design.fileId,
    originalName: design.file.originalName,
    mimeType: design.file.mimeType,
    comments: design.reviewComments,
  };
}

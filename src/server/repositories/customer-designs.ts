/**
 * P9 phase 2: the "moje wzory" library — a customer's own uploaded
 * `CustomerDesign` rows, browsable outside any one product's configurator
 * flow so they can genuinely be reused across products/orders (the DB
 * relation already allowed this — `CustomerDesign.configurations` is
 * plural — this file is what finally lets a customer see and pick from
 * their own history instead of only ever uploading fresh).
 *
 * Same `find*(owner)` / `require*()` split as `design-review.ts` — a pure,
 * directly-testable query plus a thin wrapper that derives the owner from
 * the real request. `next/headers` cannot be exercised outside a request,
 * so the split is what keeps the query itself unit/integration-testable.
 */

import { prisma } from '@/server/db/client';
import type { DesignReviewStatus } from '@/generated/prisma/enums';
import type { Owner } from '@/server/session/ownership';
import { currentOwner, hasNoOwner, ownerOrClauses } from '@/server/session/ownership';

export type OwnedCustomerDesignListItem = {
  readonly id: string;
  readonly fileId: string;
  readonly titlePl: string | null;
  readonly originalName: string;
  readonly status: DesignReviewStatus;
  readonly mimeType: string;
  readonly hasPreview: boolean;
  readonly createdAt: Date;
};

export async function listOwnedCustomerDesigns(owner: Owner): Promise<readonly OwnedCustomerDesignListItem[]> {
  if (hasNoOwner(owner)) {
    return [];
  }
  const designs = await prisma.customerDesign.findMany({
    where: { OR: ownerOrClauses(owner) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileId: true,
      titlePl: true,
      status: true,
      createdAt: true,
      file: { select: { originalName: true, mimeType: true, previewKey: true } },
    },
  });
  return designs.map((design) => ({
    id: design.id,
    fileId: design.fileId,
    titlePl: design.titlePl,
    originalName: design.file.originalName,
    status: design.status,
    mimeType: design.file.mimeType,
    hasPreview: design.file.previewKey !== null,
    createdAt: design.createdAt,
  }));
}

export async function listMyCustomerDesigns(): Promise<readonly OwnedCustomerDesignListItem[]> {
  return listOwnedCustomerDesigns(await currentOwner());
}

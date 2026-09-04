/**
 * P9 phase 2: the "moje wzory" library - a customer's own uploaded
 * `CustomerDesign` rows, browsable outside any one product's configurator
 * flow so they can genuinely be reused across products/orders (the DB
 * relation already allowed this - `CustomerDesign.configurations` is
 * plural - this file is what finally lets a customer see and pick from
 * their own history instead of only ever uploading fresh).
 *
 * Same `find*(owner)` / `require*()` split as `design-review.ts` - a pure,
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

/** Single-item variant of `listOwnedCustomerDesigns`, for `/moje-konto/wzory/[id]`'s detail page. `null` on any failure (no owner, wrong owner, no such design) - same 404-not-403 discipline as `design-review.ts`'s `findOwnedDesignStatus`. */
export async function findOwnedCustomerDesign(id: string, owner: Owner): Promise<OwnedCustomerDesignListItem | null> {
  if (hasNoOwner(owner)) {
    return null;
  }
  const design = await prisma.customerDesign.findFirst({
    where: { id, OR: ownerOrClauses(owner) },
    select: {
      id: true,
      fileId: true,
      titlePl: true,
      status: true,
      createdAt: true,
      file: { select: { originalName: true, mimeType: true, previewKey: true } },
    },
  });
  if (design === null) {
    return null;
  }
  return {
    id: design.id,
    fileId: design.fileId,
    titlePl: design.titlePl,
    originalName: design.file.originalName,
    status: design.status,
    mimeType: design.file.mimeType,
    hasPreview: design.file.previewKey !== null,
    createdAt: design.createdAt,
  };
}

export async function findMyCustomerDesign(id: string): Promise<OwnedCustomerDesignListItem | null> {
  return findOwnedCustomerDesign(id, await currentOwner());
}

/**
 * The design this owner already has for a byte-identical file, if any -
 * 2026-08-30, owner: "client should not be able to save the same project
 * twice."
 *
 * Keyed on the file's real SHA-256, which the upload inspector already
 * computes. Not the filename: a customer can rename the same artwork, and
 * two different customers routinely upload different artwork under the same
 * name ("logo.png"). Scoped to the owner, so two people uploading the same
 * stock file still get their own design and their own review thread.
 *
 * Lives here rather than inline in `actions/upload.ts` for the reason this
 * file's own header gives: that action reads `next/headers` and cannot be
 * driven from a test, so the part worth testing has to be separable.
 */
export async function findOwnedDesignByChecksum(owner: Owner, checksumSha256: string): Promise<{ readonly id: string } | null> {
  if (hasNoOwner(owner)) {
    return null;
  }
  return prisma.customerDesign.findFirst({
    where: { OR: ownerOrClauses(owner), file: { checksumSha256 } },
    select: { id: true },
    // Newest wins: if historical duplicates exist from before this check,
    // a re-upload should attach to the one the customer most recently saw.
    orderBy: { createdAt: 'desc' },
  });
}

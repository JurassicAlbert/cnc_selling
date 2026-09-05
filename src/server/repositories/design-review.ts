import { prisma } from '@/server/db/client';
import type { Owner } from '@/server/session/ownership';
import { currentOwner, hasNoOwner, ownerOrClauses } from '@/server/session/ownership';

/**
 * Ownership checks for `UploadedFile`/`CustomerDesign`. §16.1:
 * "`UploadedFile`, `CustomerDesign`... access requires `userId` match
 * **or** matching guest `sessionToken`" - extended in P6 to actually check
 * `userId` now that real accounts exist (`ownerOrClauses` from
 * `server/session/ownership.ts`); before P6 `userId` was always `null` in
 * practice, so this was `sessionToken`-only.
 *
 * Every check below is split in two, deliberately: a pure `find*`
 * function taking an `Owner` as an explicit parameter (a real DB
 * query, nothing else - genuinely callable from an integration test),
 * and a `require*` wrapper that derives the owner from the request's
 * cookies/session and delegates. `next/headers`'s `cookies()`/`headers()`
 * throw outside an actual Next.js request scope (confirmed empirically -
 * Vitest calling a function that reads it directly fails with "cookies
 * was called outside a request scope"), so a repository function that
 * reads cookies itself cannot be unit- or integration-tested by calling
 * it directly. This split is the same shape `cart.ts`'s
 * `verifyOwnedCustomDesign` already uses (session derived once at the
 * call site, threaded through as a parameter) - applied here
 * systematically rather than case-by-case.
 */

export type OwnedUploadedFile = {
  readonly id: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly originalName: string;
};

/** `null` on any failure (no owner, wrong owner, no such file) - the caller (the `/api/plik/[fileId]` route) must turn that into a 404, never a 403, per §16.1. */
export async function findOwnedUploadedFile(fileId: string, owner: Owner): Promise<OwnedUploadedFile | null> {
  if (hasNoOwner(owner)) {
    return null;
  }
  return prisma.uploadedFile.findFirst({
    /*
      BUG-15: `supersededAt: null` is an authorization condition, not a
      filter. Ownership is unchanged when a customer replaces their design -
      it is still their file - so the refusal has to come from the file having
      been superseded, and it belongs in the same query as the owner check
      rather than as a second read the caller might forget.

      Staff do not come through here at all (`/api/plik/[fileId]` reads any
      file directly for a non-CUSTOMER session), which is what makes a
      superseded upload staff-visible history and nothing more. Deliberately
      no expiry: the owner was offered one and refused it, so a file stays
      reachable to staff for as long as it exists.
    */
    where: { id: fileId, supersededAt: null, OR: ownerOrClauses(owner) },
    select: { id: true, storageKey: true, mimeType: true, originalName: true },
  });
}

export async function requireOwnedUploadedFile(fileId: string): Promise<OwnedUploadedFile | null> {
  return findOwnedUploadedFile(fileId, await currentOwner());
}

export type OwnedDesignComment = {
  readonly id: string;
  readonly authorType: string;
  readonly bodyPl: string;
  readonly createdAt: Date;
};

export type OwnedDesignStatus = {
  readonly id: string;
  /** Plain status only - `productionMethod` is internal, never surfaced to the customer (§13.3). */
  readonly status: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
  readonly comments: readonly OwnedDesignComment[];
};

/** `null` on any failure - same 404-not-403 discipline as `findOwnedUploadedFile`. */
export async function findOwnedDesignStatus(designId: string, owner: Owner): Promise<OwnedDesignStatus | null> {
  if (hasNoOwner(owner)) {
    return null;
  }
  const design = await prisma.customerDesign.findFirst({
    where: { id: designId, OR: ownerOrClauses(owner) },
    select: {
      id: true,
      status: true,
      reviewComments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorType: true, bodyPl: true, createdAt: true },
      },
    },
  });
  if (design === null) {
    return null;
  }
  return { id: design.id, status: design.status, comments: design.reviewComments };
}

export async function requireOwnedDesignStatus(designId: string): Promise<OwnedDesignStatus | null> {
  return findOwnedDesignStatus(designId, await currentOwner());
}

/** For `src/server/actions/upload.ts`'s re-upload path and `cart.ts`'s `verifyOwnedCustomDesign` - just confirms ownership, doesn't fetch the full status. */
export async function findOwnedDesignId(designId: string, owner: Owner): Promise<boolean> {
  if (hasNoOwner(owner)) {
    return false;
  }
  const design = await prisma.customerDesign.findFirst({
    where: { id: designId, OR: ownerOrClauses(owner) },
    select: { id: true },
  });
  return design !== null;
}

export async function requireOwnedDesignId(designId: string): Promise<Owner | null> {
  const owner = await currentOwner();
  if (hasNoOwner(owner) || !(await findOwnedDesignId(designId, owner))) {
    return null;
  }
  return owner;
}

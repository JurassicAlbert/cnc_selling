import { cookies } from 'next/headers';

import { prisma } from '@/server/db/client';
import { isValidSignedSessionValue, requireSessionSecret } from '@/server/session/guest-session';
import { GUEST_SESSION_COOKIE_NAME } from '@/server/session/read-guest-session';

/**
 * Ownership checks for `UploadedFile`/`CustomerDesign`. §16.1:
 * "`UploadedFile`, `CustomerDesign`... access requires `userId` match
 * **or** matching guest `sessionToken`" — `userId` is always `null` in
 * practice today (no real auth exists until P6), but the check still
 * covers it so nothing here needs to change once P6 lands.
 *
 * Every check below is split in two, deliberately: a pure `find*`
 * function taking `sessionToken` as an explicit parameter (a real DB
 * query, nothing else — genuinely callable from an integration test),
 * and a `require*` wrapper that derives the token from the request's
 * cookies and delegates. `next/headers`'s `cookies()` throws outside an
 * actual Next.js request scope (confirmed empirically — Vitest calling a
 * function that reads it directly fails with "cookies was called
 * outside a request scope"), so a repository function that reads cookies
 * itself cannot be unit- or integration-tested by calling it directly.
 * This split is the same shape `cart.ts`'s `verifyOwnedCustomDesign`
 * already uses (session derived once at the call site, threaded through
 * as a parameter) — applied here systematically rather than
 * case-by-case.
 */
export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (value === undefined || !isValidSignedSessionValue(value, requireSessionSecret())) {
    return null;
  }
  return value;
}

export type OwnedUploadedFile = {
  readonly id: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly originalName: string;
};

/** `null` on any failure (no session, wrong session, no such file) — the caller (the `/api/plik/[fileId]` route) must turn that into a 404, never a 403, per §16.1. */
export async function findOwnedUploadedFile(
  fileId: string,
  sessionToken: string | null,
): Promise<OwnedUploadedFile | null> {
  if (sessionToken === null) {
    return null;
  }
  return prisma.uploadedFile.findFirst({
    where: { id: fileId, sessionToken },
    select: { id: true, storageKey: true, mimeType: true, originalName: true },
  });
}

export async function requireOwnedUploadedFile(fileId: string): Promise<OwnedUploadedFile | null> {
  return findOwnedUploadedFile(fileId, await currentSessionToken());
}

export type OwnedDesignComment = {
  readonly id: string;
  readonly authorType: string;
  readonly bodyPl: string;
  readonly createdAt: Date;
};

export type OwnedDesignStatus = {
  readonly id: string;
  /** Plain status only — `productionMethod` is internal, never surfaced to the customer (§13.3). */
  readonly status: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
  readonly comments: readonly OwnedDesignComment[];
};

/** `null` on any failure — same 404-not-403 discipline as `findOwnedUploadedFile`. */
export async function findOwnedDesignStatus(
  designId: string,
  sessionToken: string | null,
): Promise<OwnedDesignStatus | null> {
  if (sessionToken === null) {
    return null;
  }
  const design = await prisma.customerDesign.findFirst({
    where: { id: designId, sessionToken },
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
  return findOwnedDesignStatus(designId, await currentSessionToken());
}

/** For `src/server/actions/upload.ts`'s re-upload path and `cart.ts`'s `verifyOwnedCustomDesign` — just confirms ownership, doesn't fetch the full status. */
export async function findOwnedDesignId(designId: string, sessionToken: string | null): Promise<boolean> {
  if (sessionToken === null) {
    return false;
  }
  const design = await prisma.customerDesign.findFirst({ where: { id: designId, sessionToken }, select: { id: true } });
  return design !== null;
}

export async function requireOwnedDesignId(designId: string): Promise<{ readonly sessionToken: string } | null> {
  const sessionToken = await currentSessionToken();
  if (sessionToken === null || !(await findOwnedDesignId(designId, sessionToken))) {
    return null;
  }
  return { sessionToken };
}

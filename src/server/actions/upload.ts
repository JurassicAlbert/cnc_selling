'use server';

/**
 * The customer-upload Server Action — `ARCHITECTURE.md` §13's full
 * pipeline (validation, IP consent, `CustomerDesign` creation) wired to
 * real storage and the DB, following the same "re-derive ownership from
 * the session, re-validate everything server-side" discipline as
 * `cart.ts`'s `addToCart`.
 *
 * **No DPI/aspect-mismatch target size is passed here, on purpose:**
 * `domain/configuration/steps.ts`'s own `STEPS_BY_PRODUCT_TYPE.CUSTOM`
 * is `['CUSTOM_UPLOAD', 'MATERIAL', 'SIZE', 'FINISH', 'PERSONALIZATION',
 * 'SUMMARY']` — `CUSTOM_UPLOAD` always comes *before* `SIZE` in the only
 * product type that has this step at all, so there is no target size to
 * compare the upload against yet at the moment of upload. `target: null`
 * is passed to `inspectUploadedFile`, which is honest to the real step
 * order rather than inventing a size to check against. If a future
 * product type ever puts `CUSTOM_UPLOAD` after `SIZE`, this is the spot
 * to pass a real target.
 */

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';

import { UPLOAD } from '@/content/pl/upload';
import type { UploadWarning } from '@/domain/upload/inspect';
import { sanitizeFilenameForDisplay } from '@/domain/upload/inspect';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { getSession } from '@/server/auth/session';
import { ensureGuestSessionToken } from '@/server/session/guest-session';
import { findOwnedDesignByChecksum } from '@/server/repositories/customer-designs';
import { storage } from '@/server/storage/local-disk';
import type { InspectFileErrorCode } from '@/server/upload/inspect-file';
import { inspectUploadedFile } from '@/server/upload/inspect-file';
import { isUploadRateLimited } from '@/server/upload/rate-limit';

/** Same intentional double-cast as `cart.ts`/`create-order.ts`'s `toJsonInput` — a single, named, auditable spot rather than an unchecked cast scattered through the file. */
function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export type UploadCustomDesignErrorCode = 'NO_FILE' | 'CONSENT_REQUIRED' | 'RATE_LIMITED' | InspectFileErrorCode;

export type UploadCustomDesignResult =
  | { readonly ok: true; readonly customerDesignId: string; readonly warnings: UploadWarning[] }
  | { readonly ok: false; readonly code: UploadCustomDesignErrorCode; readonly params?: Record<string, number> };

/**
 * Best-effort client IP for `CustomerDesign.ipConfirmedIp` — read from
 * `X-Forwarded-For` (set by virtually every reverse proxy/CDN in front
 * of a real deployment). `null` in local dev with no proxy in front,
 * which is honest: there is no request IP to record there, not a bug to
 * paper over with a fake value.
 */
async function requestIpAddress(): Promise<string | null> {
  const store = await headers();
  const forwardedFor = store.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() ?? null;
}

export async function uploadCustomDesign(formData: FormData): Promise<UploadCustomDesignResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: 'NO_FILE' };
  }

  // §13.2: rejected server-side if missing — the client checkbox being
  // unchecked-by-default is a UI nicety, this is the actual enforcement.
  if (formData.get('ipConsent') !== 'on') {
    return { ok: false, code: 'CONSENT_REQUIRED' };
  }

  const sessionToken = await ensureGuestSessionToken();
  const session = await getSession();
  const userId = session?.userId ?? null;

  if (await isUploadRateLimited({ sessionToken, userId })) {
    return { ok: false, code: 'RATE_LIMITED' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const inspected = await inspectUploadedFile({ bytes, target: null });
  if (!inspected.ok) {
    return { ok: false, code: inspected.code, params: inspected.params };
  }

  // The same file, uploaded again by the same person, is the same design —
  // not a second one (owner, 2026-08-30: "client should not be able to save
  // the same project twice"). `/moje-konto/wzory` lists `CustomerDesign`
  // rows directly, so without this a customer who re-picked the same file
  // (or double-submitted the form) ended up with two identical entries in
  // their own library, each with its own review thread.
  //
  // Matched on the file's real SHA-256, which `inspectUploadedFile` already
  // computes — not on the filename, which a customer can change without
  // changing the artwork, and which two different customers routinely share
  // ("logo.png"). Scoped to this owner: two people uploading the same stock
  // file must still get their own design and their own review.
  //
  // Checked BEFORE writing to storage, so a repeat upload also stops
  // leaving an orphaned copy of the bytes on disk.
  const existingDesign = await findOwnedDesignByChecksum({ userId, sessionToken }, inspected.checksumSha256);
  if (existingDesign !== null) {
    return { ok: true, customerDesignId: existingDesign.id, warnings: inspected.warnings };
  }

  const storageKey = randomUUID();
  await storage.put(storageKey, inspected.storedBytes);

  let previewKey: string | null = null;
  if (inspected.previewBytes !== null) {
    previewKey = randomUUID();
    await storage.put(previewKey, inspected.previewBytes);
  }

  const originalName = sanitizeFilenameForDisplay(file.name);
  const ipConfirmedIp = await requestIpAddress();
  // Optional — an upload triggered inline from a product's configurator
  // (no title field on that form) still works exactly as before; only the
  // standalone "moje wzory" library page's form actually sends one.
  const titlePlRaw = formData.get('titlePl');
  const titlePl = typeof titlePlRaw === 'string' && titlePlRaw.trim().length > 0 ? titlePlRaw.trim() : null;

  const design = await prisma.$transaction(async (tx) => {
    const uploadedFile = await tx.uploadedFile.create({
      data: {
        userId,
        sessionToken,
        kind: 'CUSTOMER_DESIGN',
        storageKey,
        originalName,
        mimeType: inspected.mimeType,
        sizeBytes: inspected.sizeBytes,
        checksumSha256: inspected.checksumSha256,
        widthPx: inspected.widthPx,
        heightPx: inspected.heightPx,
        pageCount: inspected.pageCount,
        previewKey,
      },
    });
    return tx.customerDesign.create({
      data: {
        fileId: uploadedFile.id,
        userId,
        sessionToken,
        status: 'PENDING_REVIEW',
        titlePl,
        autoWarnings: toJsonInput(inspected.warnings),
        ipConfirmedAt: new Date(),
        ipDeclarationVersion: UPLOAD.ipDeclarationVersion,
        ipDeclarationTextPl: UPLOAD.ipDeclarationTextPl,
        ipConfirmedIp,
      },
    });
  });

  return { ok: true, customerDesignId: design.id, warnings: inspected.warnings };
}

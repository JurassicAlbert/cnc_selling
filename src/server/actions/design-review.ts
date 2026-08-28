'use server';

/**
 * The customer's half of the design-review workflow (§13.3) — re-upload
 * after `NEEDS_CHANGES`. The staff half (approve/request-changes/reject)
 * is deliberately not built here: it needs a real, authenticated STAFF
 * actor, and that role model doesn't exist yet (P6/P7, not started).
 * `domain/design-review/transitions.ts`'s `checkDesignReviewTransition`
 * already models those edges and is unit-tested directly — P7's admin
 * panel wires a UI to it later; this file only calls the one edge a
 * customer can actually trigger themselves right now.
 */

import { randomUUID } from 'node:crypto';

import { checkDesignReviewTransition } from '@/domain/design-review/transitions';
import type { DesignReviewTransitionIssueCode } from '@/domain/design-review/transitions';
import { sanitizeFilenameForDisplay } from '@/domain/upload/inspect';
import type { UploadWarning } from '@/domain/upload/inspect';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { requireOwnedDesignId } from '@/server/repositories/design-review';
import { storage } from '@/server/storage/local-disk';
import type { InspectFileErrorCode } from '@/server/upload/inspect-file';
import { inspectUploadedFile } from '@/server/upload/inspect-file';
import { isUploadRateLimited } from '@/server/upload/rate-limit';

function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export type ReuploadCustomDesignErrorCode =
  | 'NO_FILE'
  | 'NOT_OWNED'
  | 'RATE_LIMITED'
  | DesignReviewTransitionIssueCode
  | InspectFileErrorCode;

export type ReuploadCustomDesignResult =
  | { readonly ok: true; readonly warnings: UploadWarning[] }
  | { readonly ok: false; readonly code: ReuploadCustomDesignErrorCode; readonly params?: Record<string, number> };

export async function reuploadCustomDesign(
  customerDesignId: string,
  formData: FormData,
): Promise<ReuploadCustomDesignResult> {
  const owner = await requireOwnedDesignId(customerDesignId);
  if (owner === null) {
    return { ok: false, code: 'NOT_OWNED' };
  }
  const { userId, sessionToken } = owner;

  const current = await prisma.customerDesign.findUniqueOrThrow({
    where: { id: customerDesignId },
    select: { status: true },
  });

  const transition = checkDesignReviewTransition({
    fromStatus: current.status,
    toStatus: 'PENDING_REVIEW',
    actorType: 'customer',
  });
  if (!transition.ok) {
    return { ok: false, code: transition.code };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: 'NO_FILE' };
  }

  if (await isUploadRateLimited({ sessionToken, userId })) {
    return { ok: false, code: 'RATE_LIMITED' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const inspected = await inspectUploadedFile({ bytes, target: null });
  if (!inspected.ok) {
    return { ok: false, code: inspected.code, params: inspected.params };
  }

  const storageKey = randomUUID();
  await storage.put(storageKey, inspected.storedBytes);

  let previewKey: string | null = null;
  if (inspected.previewBytes !== null) {
    previewKey = randomUUID();
    await storage.put(previewKey, inspected.previewBytes);
  }

  const originalName = sanitizeFilenameForDisplay(file.name);

  // A re-upload is a genuinely new UploadedFile (its own storage key,
  // its own inspection result) linked to the SAME CustomerDesign — the
  // review restarts on the new file, but its id (and any customer-facing
  // link/order reference to it) stays stable.
  await prisma.$transaction(async (tx) => {
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
    await tx.customerDesign.update({
      where: { id: customerDesignId },
      data: {
        fileId: uploadedFile.id,
        status: 'PENDING_REVIEW',
        autoWarnings: toJsonInput(inspected.warnings),
      },
    });
  });

  return { ok: true, warnings: inspected.warnings };
}

import { describe, expect, it } from 'vitest';

import { checkDesignReviewTransition } from '@/domain/design-review/transitions';
import type { DesignReviewStatus } from '@/domain/design-review/transitions';
import { withTestTransaction } from './setup';

/**
 * The real DB round-trip for `ARCHITECTURE.md` §13.3's review workflow -
 * every legal transition, illegal transitions correctly refused before
 * any write happens, re-upload after `NEEDS_CHANGES`, and comment
 * authorship. Uses `withTestTransaction` throughout (write and read both
 * via `tx`) rather than the app's `prisma` singleton - see
 * `authz.test.ts`'s header for why those two approaches can't be mixed
 * within one test.
 *
 * A genuine integration-level check this buys beyond
 * `tests/unit/design-review-transitions.test.ts`'s pure domain
 * assertions: that `domain/design-review/transitions.ts`'s string
 * literals (`'PENDING_REVIEW'`, `'APPROVED'`, ...) are exactly what
 * Prisma's generated `DesignReviewStatus` enum actually contains - a
 * renamed enum value in the schema would fail these tests at the
 * `tx.customerDesign.update` call, not silently mismatch.
 */

async function seedPendingDesign(tx: Parameters<Parameters<typeof withTestTransaction>[0]>[0]) {
  const sessionToken = `test-design-review-${crypto.randomUUID()}`;
  const file = await tx.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: `design-review-test-${crypto.randomUUID()}`,
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
  return tx.customerDesign.create({
    data: { fileId: file.id, sessionToken, status: 'PENDING_REVIEW' },
  });
}

/** Only writes if the domain function actually allows the transition - mirrors how a real caller (a future P7 review action) must gate its own write. */
async function applyTransition(
  tx: Parameters<Parameters<typeof withTestTransaction>[0]>[0],
  designId: string,
  fromStatus: DesignReviewStatus,
  toStatus: DesignReviewStatus,
  actorType: 'staff' | 'customer',
) {
  const result = checkDesignReviewTransition({ fromStatus, toStatus, actorType });
  if (!result.ok) {
    return result;
  }
  await tx.customerDesign.update({ where: { id: designId }, data: { status: toStatus } });
  return result;
}

describe('the review lifecycle, real DB round-trip', () => {
  it('PENDING_REVIEW → APPROVED (staff)', async () => {
    await withTestTransaction(async (tx) => {
      const design = await seedPendingDesign(tx);
      const result = await applyTransition(tx, design.id, 'PENDING_REVIEW', 'APPROVED', 'staff');
      expect(result.ok).toBe(true);

      const reloaded = await tx.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(reloaded.status).toBe('APPROVED');
    });
  });

  it('PENDING_REVIEW → NEEDS_CHANGES (staff) → PENDING_REVIEW (customer re-upload)', async () => {
    await withTestTransaction(async (tx) => {
      const design = await seedPendingDesign(tx);

      const toNeedsChanges = await applyTransition(tx, design.id, 'PENDING_REVIEW', 'NEEDS_CHANGES', 'staff');
      expect(toNeedsChanges.ok).toBe(true);
      let reloaded = await tx.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(reloaded.status).toBe('NEEDS_CHANGES');

      // The re-upload itself creates a NEW UploadedFile and repoints
      // `fileId` - see `server/actions/design-review.ts`'s real
      // implementation. Here we only assert the status half of that,
      // which is what the domain transition function governs.
      const backToPending = await applyTransition(tx, design.id, 'NEEDS_CHANGES', 'PENDING_REVIEW', 'customer');
      expect(backToPending.ok).toBe(true);
      reloaded = await tx.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(reloaded.status).toBe('PENDING_REVIEW');
    });
  });

  it('PENDING_REVIEW → REJECTED (staff) is terminal - no further transition writes', async () => {
    await withTestTransaction(async (tx) => {
      const design = await seedPendingDesign(tx);
      const rejected = await applyTransition(tx, design.id, 'PENDING_REVIEW', 'REJECTED', 'staff');
      expect(rejected.ok).toBe(true);

      const attemptedRecovery = await applyTransition(tx, design.id, 'REJECTED', 'PENDING_REVIEW', 'customer');
      expect(attemptedRecovery.ok).toBe(false);

      // The illegal attempt must not have written anything - status stays REJECTED.
      const reloaded = await tx.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(reloaded.status).toBe('REJECTED');
    });
  });

  it('a customer cannot approve their own design - illegal actor, no write', async () => {
    await withTestTransaction(async (tx) => {
      const design = await seedPendingDesign(tx);
      const result = await applyTransition(tx, design.id, 'PENDING_REVIEW', 'APPROVED', 'customer');
      expect(result.ok).toBe(false);

      const reloaded = await tx.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
      expect(reloaded.status).toBe('PENDING_REVIEW');
    });
  });
});

describe('review comments - authorship persists correctly', () => {
  it('stores staff and customer comments distinctly, in order', async () => {
    await withTestTransaction(async (tx) => {
      const design = await seedPendingDesign(tx);

      await tx.designReviewComment.create({
        data: { designId: design.id, authorType: 'staff', bodyPl: 'Proszę o wyższą rozdzielczość pliku.' },
      });
      await tx.designReviewComment.create({
        data: { designId: design.id, authorType: 'customer', bodyPl: 'Przesyłam poprawiony plik.' },
      });

      const comments = await tx.designReviewComment.findMany({
        where: { designId: design.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(comments).toHaveLength(2);
      expect(comments[0]?.authorType).toBe('staff');
      expect(comments[1]?.authorType).toBe('customer');
    });
  });
});

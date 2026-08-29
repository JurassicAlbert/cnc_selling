import { afterEach, describe, expect, it } from 'vitest';

import { applyPostCustomerDesignComment } from '@/server/operations/design-review';
import { findOwnedDesignStatus } from '@/server/repositories/design-review';
import { prisma } from '@/server/db/client';

/**
 * P9 continuation, 2026-08-28 — the customer-facing half of the design
 * review "dyskusja" the owner asked for. `findOwnedDesignStatus` itself
 * predates this pass (built for P7, never consumed by any page until now)
 * and had no direct test either — covered here alongside the new write
 * side. Real `prisma` singleton + PREFIX cleanup, same shape as
 * `customer-designs.test.ts` (this file's functions take an `Owner`
 * derived from cookies in the real request, not a `tx` parameter, so
 * `withTestTransaction` doesn't apply here).
 */

const PREFIX = 'test-design-review-customer-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedDesign(sessionToken: string) {
  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: uid(),
      originalName: 'projekt.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 1_000,
      checksumSha256: 'a'.repeat(64),
    },
  });
  return prisma.customerDesign.create({
    data: { fileId: file.id, sessionToken, status: 'PENDING_REVIEW' },
  });
}

afterEach(async () => {
  await prisma.designReviewComment.deleteMany({ where: { design: { file: { storageKey: { startsWith: PREFIX } } } } });
  await prisma.customerDesign.deleteMany({ where: { file: { storageKey: { startsWith: PREFIX } } } });
  await prisma.uploadedFile.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
});

describe('applyPostCustomerDesignComment', () => {
  it('creates a customer-authored comment for the real owner', async () => {
    const sessionToken = uid();
    const design = await seedDesign(sessionToken);

    const result = await applyPostCustomerDesignComment({ userId: null, sessionToken }, design.id, 'Mam pytanie o ten projekt.');
    expect(result.ok).toBe(true);

    const comments = await prisma.designReviewComment.findMany({ where: { designId: design.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0]?.authorType).toBe('customer');
    expect(comments[0]?.bodyPl).toBe('Mam pytanie o ten projekt.');
  });

  it('refuses to post for a design the caller does not own — no write', async () => {
    const design = await seedDesign(uid());

    const result = await applyPostCustomerDesignComment({ userId: null, sessionToken: uid() }, design.id, 'Nie moje.');
    expect(result).toEqual({ ok: false, code: 'NOT_OWNED' });

    const comments = await prisma.designReviewComment.findMany({ where: { designId: design.id } });
    expect(comments).toHaveLength(0);
  });

  it('refuses an empty or whitespace-only comment', async () => {
    const sessionToken = uid();
    const design = await seedDesign(sessionToken);

    const result = await applyPostCustomerDesignComment({ userId: null, sessionToken }, design.id, '   ');
    expect(result).toEqual({ ok: false, code: 'EMPTY_COMMENT' });
  });
});

describe('findOwnedDesignStatus', () => {
  it('returns status and the full comment thread, in order, for the real owner', async () => {
    const sessionToken = uid();
    const design = await seedDesign(sessionToken);
    await prisma.designReviewComment.create({
      data: { designId: design.id, authorType: 'staff', bodyPl: 'Proszę o wyższą rozdzielczość.' },
    });
    await applyPostCustomerDesignComment({ userId: null, sessionToken }, design.id, 'Przesyłam poprawiony plik.');

    const result = await findOwnedDesignStatus(design.id, { userId: null, sessionToken });

    expect(result).not.toBeNull();
    expect(result?.status).toBe('PENDING_REVIEW');
    expect(result?.comments).toHaveLength(2);
    expect(result?.comments[0]?.authorType).toBe('staff');
    expect(result?.comments[1]?.authorType).toBe('customer');
  });

  it('returns null for a design owned by someone else — 404, not 403', async () => {
    const design = await seedDesign(uid());

    const result = await findOwnedDesignStatus(design.id, { userId: null, sessionToken: uid() });

    expect(result).toBeNull();
  });
});

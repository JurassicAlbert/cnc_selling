import { afterEach, describe, expect, it } from 'vitest';

import { findOwnedDesignByChecksum, listOwnedCustomerDesigns } from '@/server/repositories/customer-designs';
import { prisma } from '@/server/db/client';

/**
 * P9 phase 2's "moje wzory" library - real DB round-trip for the query
 * that page (and the configurator's reuse picker) is built on. Uses the
 * app's own `prisma` singleton (this repository function does too, unlike
 * `design-review.test.ts`'s `withTestTransaction`-scoped tests), so
 * cleanup is via a real `afterEach`, same PREFIX-based pattern as every
 * other singleton-`prisma` integration test this session added.
 */

const PREFIX = 'test-customer-designs-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedCustomerDesign(overrides: {
  readonly sessionToken?: string;
  readonly userId?: string;
  readonly titlePl?: string | null;
  readonly status?: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
  readonly previewKey?: string | null;
  readonly checksumSha256?: string;
}) {
  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken: overrides.sessionToken ?? null,
      userId: overrides.userId ?? null,
      kind: 'CUSTOMER_DESIGN',
      storageKey: uid(),
      originalName: 'projekt.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 1_000,
      checksumSha256: overrides.checksumSha256 ?? 'a'.repeat(64),
      previewKey: overrides.previewKey ?? null,
    },
  });
  return prisma.customerDesign.create({
    data: {
      fileId: file.id,
      sessionToken: overrides.sessionToken ?? null,
      userId: overrides.userId ?? null,
      titlePl: overrides.titlePl ?? null,
      status: overrides.status ?? 'PENDING_REVIEW',
    },
  });
}

afterEach(async () => {
  await prisma.customerDesign.deleteMany({ where: { file: { storageKey: { startsWith: PREFIX } } } });
  await prisma.uploadedFile.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('listOwnedCustomerDesigns', () => {
  it('returns a guest session token owner’s own designs, with the real title and status', async () => {
    const sessionToken = uid();
    const design = await seedCustomerDesign({ sessionToken, titlePl: 'Logo firmy', status: 'APPROVED' });

    const result = await listOwnedCustomerDesigns({ userId: null, sessionToken });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(design.id);
    expect(result[0]?.titlePl).toBe('Logo firmy');
    expect(result[0]?.status).toBe('APPROVED');
    expect(result[0]?.originalName).toBe('projekt.svg');
  });

  it('never returns another owner’s designs - same isolation `findOwnedDesignId` already relies on', async () => {
    const mine = uid();
    const someoneElses = uid();
    await seedCustomerDesign({ sessionToken: someoneElses, titlePl: 'Nie moje' });
    await seedCustomerDesign({ sessionToken: mine, titlePl: 'Moje' });

    const result = await listOwnedCustomerDesigns({ userId: null, sessionToken: mine });

    expect(result).toHaveLength(1);
    expect(result[0]?.titlePl).toBe('Moje');
  });

  it('matches by userId when logged in, independent of sessionToken', async () => {
    const user = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER' } });
    await seedCustomerDesign({ userId: user.id, titlePl: 'Wzór zalogowanego klienta' });

    const result = await listOwnedCustomerDesigns({ userId: user.id, sessionToken: null });

    expect(result).toHaveLength(1);
    expect(result[0]?.titlePl).toBe('Wzór zalogowanego klienta');
  });

  it('returns an empty list for a real "no owner" request rather than throwing or matching everything', async () => {
    await seedCustomerDesign({ sessionToken: uid() });

    const result = await listOwnedCustomerDesigns({ userId: null, sessionToken: null });

    expect(result).toEqual([]);
  });

  it('reports hasPreview correctly, and orders newest-first', async () => {
    const sessionToken = uid();
    const older = await seedCustomerDesign({ sessionToken, titlePl: 'Starszy', previewKey: null });
    // Ensure a distinguishable `createdAt` ordering without relying on timing flakiness.
    await prisma.customerDesign.update({ where: { id: older.id }, data: { createdAt: new Date('2026-01-01') } });
    await seedCustomerDesign({ sessionToken, titlePl: 'Nowszy', previewKey: uid() });

    const result = await listOwnedCustomerDesigns({ userId: null, sessionToken });

    expect(result).toHaveLength(2);
    expect(result[0]?.titlePl).toBe('Nowszy');
    expect(result[0]?.hasPreview).toBe(true);
    expect(result[1]?.titlePl).toBe('Starszy');
    expect(result[1]?.hasPreview).toBe(false);
  });
});

/**
 * 2026-08-30, owner: "client should not be able to save the same project
 * twice." `uploadCustomDesign` creates a `CustomerDesign` per upload, and
 * `/moje-konto/wzory` lists those rows directly - so re-picking the same
 * file, or double-submitting the form, put two identical entries in a
 * customer's own library, each with its own review thread. This is the
 * lookup that stops it; the action itself reads `next/headers` and can only
 * be exercised end to end by the e2e suite.
 */
describe('findOwnedDesignByChecksum - one design per identical file, per owner', () => {
  const CHECKSUM = 'b'.repeat(64);

  it('finds this owner’s existing design for a byte-identical file', async () => {
    const sessionToken = uid();
    const design = await seedCustomerDesign({ sessionToken, checksumSha256: CHECKSUM });

    const found = await findOwnedDesignByChecksum({ userId: null, sessionToken }, CHECKSUM);

    expect(found?.id).toBe(design.id);
  });

  it('does not match a different file', async () => {
    const sessionToken = uid();
    await seedCustomerDesign({ sessionToken, checksumSha256: CHECKSUM });

    expect(await findOwnedDesignByChecksum({ userId: null, sessionToken }, 'c'.repeat(64))).toBeNull();
  });

  /**
   * The case that makes checksum-only matching wrong: two customers
   * uploading the same stock file must each get their own design and their
   * own review, not share one.
   */
  it('never returns another owner’s design for the same file', async () => {
    const mine = uid();
    const theirs = uid();
    await seedCustomerDesign({ sessionToken: theirs, checksumSha256: CHECKSUM });

    expect(await findOwnedDesignByChecksum({ userId: null, sessionToken: mine }, CHECKSUM)).toBeNull();
  });

  it('returns nothing for a caller with no identity at all', async () => {
    const theirs = uid();
    await seedCustomerDesign({ sessionToken: theirs, checksumSha256: CHECKSUM });

    expect(await findOwnedDesignByChecksum({ userId: null, sessionToken: null }, CHECKSUM)).toBeNull();
  });
});

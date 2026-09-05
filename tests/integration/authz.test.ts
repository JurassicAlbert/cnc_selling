import { afterEach, describe, expect, it } from 'vitest';

import {
  findOwnedDesignId,
  findOwnedDesignStatus,
  findOwnedUploadedFile,
} from '@/server/repositories/design-review';
import type { Owner } from '@/server/session/ownership';
import { isUploadRateLimited } from '@/server/upload/rate-limit';
import { prisma } from '@/server/db/client';

/**
 * §16.2's authorization matrix, scoped to what P4 actually touches:
 * `UploadedFile`/`CustomerDesign` access. Calls the pure `find*`
 * functions directly (session token as an explicit parameter) rather
 * than the `require*` wrappers - the wrappers call `next/headers`'s
 * `cookies()`, which throws outside a real Next.js request (confirmed
 * empirically while building this suite); see
 * `src/server/repositories/design-review.ts`'s header for the full
 * reasoning. The `find*` functions run the exact same query the
 * `require*` wrappers delegate to, so this genuinely exercises the
 * real authorization logic against real Postgres, not a re-implementation.
 *
 * **No transaction-rollback isolation here, on purpose.** These
 * functions use the app's own `prisma` singleton internally (not an
 * injected client), and Prisma's interactive `$transaction` runs on its
 * own dedicated connection - a row written via `tx.uploadedFile.create`
 * inside an open, uncommitted transaction is invisible to a plain
 * `prisma.uploadedFile.findFirst` call from a different connection
 * (`findOwnedUploadedFile`'s own query) until that transaction commits.
 * `withTestTransaction` (`tests/integration/setup.ts`) works fine for
 * tests that only ever touch its own `tx`, but the moment a test needs
 * to call a real app function that uses the singleton, seeding must go
 * through that same singleton too. So this file commits for real, with
 * every row's `sessionToken` prefixed `test-authz-` and an `afterEach`
 * that deletes everything under that prefix - the same "real database,
 * explicit cleanup" pattern this project's own e2e suite already uses
 * (real orders, real order numbers, per `docs/CHECKLIST.md`).
 */

const PREFIX = 'test-authz-';

function token(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function owner(sessionToken: string | null): Owner {
  return { userId: null, sessionToken };
}

afterEach(async () => {
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

async function seedUploadedFile(sessionToken: string) {
  return prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: `authz-test-${crypto.randomUUID()}`,
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
}

async function seedDesign(sessionToken: string) {
  const file = await seedUploadedFile(sessionToken);
  return prisma.customerDesign.create({
    data: { fileId: file.id, sessionToken, status: 'PENDING_REVIEW' },
  });
}

describe('UploadedFile ownership (§16.2: "Customer A / Customer B\'s uploaded file" → 404)', () => {
  it('the owning session finds its own file', async () => {
    const ownerToken = token();
    const file = await seedUploadedFile(ownerToken);

    const found = await findOwnedUploadedFile(file.id, owner(ownerToken));
    expect(found?.id).toBe(file.id);
  });

  it('a different session gets null - the 404-not-403 case', async () => {
    const ownerToken = token();
    const strangerToken = token();
    const file = await seedUploadedFile(ownerToken);

    const found = await findOwnedUploadedFile(file.id, owner(strangerToken));
    expect(found).toBeNull();
  });

  it('no session (null) always gets null, without even querying', async () => {
    const ownerToken = token();
    const file = await seedUploadedFile(ownerToken);

    const found = await findOwnedUploadedFile(file.id, owner(null));
    expect(found).toBeNull();
  });

  it('a nonexistent file id gets null - indistinguishable from "not yours"', async () => {
    const found = await findOwnedUploadedFile('does-not-exist', owner(token()));
    expect(found).toBeNull();
  });
});

describe('CustomerDesign ownership', () => {
  it('findOwnedDesignStatus: owner sees their own design status', async () => {
    const ownerToken = token();
    const design = await seedDesign(ownerToken);

    const found = await findOwnedDesignStatus(design.id, owner(ownerToken));
    expect(found).toEqual({ id: design.id, status: 'PENDING_REVIEW', comments: [] });
  });

  it('findOwnedDesignStatus: a stranger session gets null', async () => {
    const ownerToken = token();
    const strangerToken = token();
    const design = await seedDesign(ownerToken);

    const found = await findOwnedDesignStatus(design.id, owner(strangerToken));
    expect(found).toBeNull();
  });

  it('findOwnedDesignId: owner check is true, stranger is false', async () => {
    const ownerToken = token();
    const strangerToken = token();
    const design = await seedDesign(ownerToken);

    expect(await findOwnedDesignId(design.id, owner(ownerToken))).toBe(true);
    expect(await findOwnedDesignId(design.id, owner(strangerToken))).toBe(false);
    expect(await findOwnedDesignId(design.id, owner(null))).toBe(false);
  });
});

describe('upload rate limiting (§16.1: "uploads per session/hour")', () => {
  it('stays unlimited below the threshold, trips once it is reached', async () => {
    const sessionToken = token();

    for (let i = 0; i < 9; i++) {
      await seedUploadedFile(sessionToken);
    }
    expect(await isUploadRateLimited({ sessionToken, userId: null })).toBe(false);

    // The 10th upload reaches MAX_UPLOADS_PER_HOUR (10) - the next check trips.
    await seedUploadedFile(sessionToken);
    expect(await isUploadRateLimited({ sessionToken, userId: null })).toBe(true);
  });

  it('is scoped per session - a different session is unaffected', async () => {
    const busyToken = token();
    const quietToken = token();
    for (let i = 0; i < 12; i++) {
      await seedUploadedFile(busyToken);
    }
    expect(await isUploadRateLimited({ sessionToken: busyToken, userId: null })).toBe(true);
    expect(await isUploadRateLimited({ sessionToken: quietToken, userId: null })).toBe(false);
  });
});

/**
 * Shared setup for the integration tier - `ARCHITECTURE.md` §21.1:
 * "Integration: Vitest + real Postgres (Docker), transaction rollback
 * per test - repositories, Server Actions, authorization." This is a
 * genuinely new tier (`tests/unit` is explicitly pure, no DB - see
 * `vitest.config.ts`'s own comment); its include glob already covers
 * `tests/integration/` with zero config changes.
 *
 * `testPrisma` is just the app's own singleton (`src/server/db/client`'s
 * `prisma`), re-exported under a clearer name - it already points at
 * `TEST_DATABASE_URL` by the time any test file imports it, because
 * `env-setup.ts` (a Vitest `setupFiles` entry, guaranteed to run before
 * a test file's own imports evaluate) overrides `DATABASE_URL` first.
 * Reusing the real singleton, rather than building a second parallel
 * Prisma client, means every repository/action function under test
 * (`findOwnedUploadedFile`, `isUploadRateLimited`, etc.) transparently
 * operates on the test database too, with no dependency-injection
 * changes needed anywhere else in the codebase.
 *
 * `withTestTransaction` runs the given function inside a real Prisma
 * interactive transaction, then deliberately throws a private sentinel
 * error at the end - Prisma rolls back the transaction on any thrown
 * error, so every write a test makes is undone before the next test
 * runs, without needing to track or manually clean up rows.
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';

export const testPrisma = prisma;

export type TestTx = Prisma.TransactionClient;

class RollbackSignal extends Error {}

export async function withTestTransaction<T>(fn: (tx: TestTx) => Promise<T>): Promise<T> {
  let captured: T | undefined;
  try {
    await testPrisma.$transaction(async (tx) => {
      captured = await fn(tx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (error instanceof RollbackSignal) {
      return captured as T;
    }
    throw error;
  }
  throw new Error('unreachable - $transaction always throws RollbackSignal or the callback error');
}

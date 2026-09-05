/**
 * Mutual exclusion for the rows the whole application shares.
 *
 * `StoreSettings` row 1 and the `EmailTemplate` rows are singletons: several
 * test files legitimately write them, and Vitest runs files in parallel in
 * separate worker processes. Two tests that each write the row and then read
 * their own value back cannot both be right, and the one that loses reports a
 * failure that has nothing to do with the code under test.
 *
 * **Not hypothetical and not new.** `admin-authorization.test.ts` has carried
 * a header about this since it was written, T-27 was an entire item about a
 * poisoned `EmailTemplate` row, and on 2026-09-05 running
 * `admin-authorization.test.ts` and `admin-store-settings.test.ts` together
 * failed **four times out of four** on a clean tree.
 *
 * What was tried first and is not enough: narrowing the window by reading
 * immediately before the call and comparing immediately after. That shrinks
 * the gap; it cannot close it, because the other file's write lands inside it.
 * Asserting only on values unique to one test fixes a test that expects *no*
 * write - but two tests that each expect their own write to stick genuinely
 * need exclusive access, and no assertion can give them that.
 *
 * **Why a Postgres advisory lock rather than a Vitest mechanism.** Vitest's
 * `sequential` orders tests within one file; these are different files in
 * different processes. `--no-file-parallelism` would work by making the whole
 * suite serial, trading a 75-second run for several minutes to solve a problem
 * affecting three files. The contention is over a database row, so the
 * database is where the lock belongs.
 *
 * **Why its own `pg.Client` rather than Prisma.** A session-level advisory
 * lock belongs to the connection that took it. Prisma pools, so a
 * `$executeRaw` lock and a `$executeRaw` unlock can land on different
 * connections and the lock is never released.
 *
 * **Why one key for every singleton rather than one per row.** A file that
 * wanted two of them could take them in the opposite order to another file
 * and deadlock, and a deadlock in a test suite is a much worse failure than
 * the flake being fixed. `admin-authorization.test.ts` touches both
 * `StoreSettings` and `EmailTemplate`, so that is a real ordering, not a
 * hypothetical one. One key costs a little parallelism across three small
 * files and cannot deadlock at all.
 */

import pg from 'pg';

/**
 * Arbitrary. It only has to be the same number in every process that wants
 * the lock.
 */
const SHARED_SINGLETON_LOCK_KEY = 918_273_641;

/**
 * Take the lock, and hand back the release.
 *
 * Meant for `beforeAll`/`afterAll`: holding it for a whole file serialises
 * that file against the others that write the same rows, which is the actual
 * requirement, and costs two lines per file instead of one wrapper per test.
 *
 * `DATABASE_URL` is read at call time rather than at import time, because
 * `env-setup.ts` points it at `TEST_DATABASE_URL` before a test file's own
 * imports evaluate - a module constant would capture whichever value happened
 * to be there first.
 */
export async function acquireSingletonLock(): Promise<() => Promise<void>> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('acquireSingletonLock needs DATABASE_URL - see tests/integration/env-setup.ts');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Blocks until whoever holds it is done. No timeout on purpose: a test
    // that waits is a test that will still run, and Vitest's own deadline is
    // already the backstop for one that never gets its turn.
    await client.query('SELECT pg_advisory_lock($1)', [SHARED_SINGLETON_LOCK_KEY]);
  } catch (error) {
    await client.end();
    throw error;
  }

  return async () => {
    // Ending the session releases the lock on its own, so the explicit
    // unlock is belt to that brace rather than the other way round.
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [SHARED_SINGLETON_LOCK_KEY]);
    } finally {
      await client.end();
    }
  };
}

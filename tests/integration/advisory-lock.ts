/**
 * One reader/writer advisory lock, for the rows the whole suite shares.
 *
 * Extracted on 2026-09-11 when T-34 needed the same mechanism `pricing-fixture.ts`
 * already had, with the polarity reversed. Extracted **before** the second
 * copy existed rather than after it drifted, which is the one improvement on
 * how `register.ts` and `fill-reliably.ts` came to be - both of those were
 * pulled out of copies that had already gone out of step, and a full run kept
 * failing in whichever file was still on the old version.
 *
 * **The shape of the problem this solves**, twice now: Vitest runs files in
 * parallel worker processes against one database, so a query with no fixture
 * filter sees every other file's rows. Two different polarities:
 *
 * - **Pricing** (T-32): one file *writes* the live version, most of the suite
 *   *reads* it. The writer takes the exclusive hold; readers take the shared
 *   one and still run alongside each other.
 * - **Production capacity** (T-34): one file *reads* a global sum, six files
 *   *write* rows that land in it. The reader takes the exclusive hold; the
 *   writers take the shared one.
 *
 * Either way the rule is the same: whoever cannot tolerate company gets
 * `pg_advisory_lock`, everyone else gets `pg_advisory_lock_shared`.
 *
 * Its own `pg.Client` rather than Prisma, for the reason `singleton-lock.ts`
 * sets out at length: a session-level advisory lock belongs to the connection
 * that took it, and Prisma pools, so a `$executeRaw` lock and a `$executeRaw`
 * unlock can land on different connections and the lock is never released.
 */

import pg from 'pg';
import { afterAll, beforeAll } from 'vitest';

export type LockMode = 'exclusive' | 'shared';

/**
 * Every key in use, in one place, so two fixtures cannot pick the same number
 * and quietly serialise against each other.
 *
 * `singleton-lock.ts` holds 918_273_641 for `StoreSettings`/`EmailTemplate`
 * and is deliberately left alone - it predates this and has no reader/writer
 * split to make.
 */
export const LOCK_KEYS = {
  /** T-32. The live `PricingSettings` row: two publishers, most of the suite reading. */
  pricing: 918_273_642,
  /** T-34. Orders in `PRODUCTION_STATUSES`: one global reader, six writers. */
  productionOrders: 918_273_643,
} as const;

const TAKE = { exclusive: 'pg_advisory_lock', shared: 'pg_advisory_lock_shared' } as const;
const GIVE = { exclusive: 'pg_advisory_unlock', shared: 'pg_advisory_unlock_shared' } as const;

/**
 * Take the lock, and hand back the release.
 *
 * `onRelease` runs while the lock is still held, so no one else can observe
 * whatever it puts back. The pricing fixture uses it to refresh the advertised
 * starting prices; a fixture with nothing to put back omits it.
 */
export async function acquireAdvisoryLock(
  key: number,
  mode: LockMode,
  onRelease?: () => Promise<void>,
): Promise<() => Promise<void>> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('acquireAdvisoryLock needs DATABASE_URL - see tests/integration/env-setup.ts');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Blocks until it is this file's turn. No timeout on purpose, same as
    // `singleton-lock.ts`: Vitest's own deadline is the backstop, and
    // `vitest.config.ts`'s `hookTimeout` was raised to 45s for exactly this
    // wait.
    await client.query(`SELECT ${TAKE[mode]}($1)`, [key]);
  } catch (error) {
    await client.end();
    throw error;
  }

  return async () => {
    try {
      if (onRelease !== undefined) {
        await onRelease();
      }
      await client.query(`SELECT ${GIVE[mode]}($1)`, [key]);
    } finally {
      await client.end();
    }
  };
}

/**
 * Register the hooks that hold a lock for a whole test file.
 *
 * One call at the top of the file. The hooks are registered here rather than
 * copied into each caller so the ordering is right by construction: Vitest's
 * default `sequence.hooks` is `"stack"`, so the `beforeAll` registered first
 * runs first and the `afterAll` registered first runs last - which is exactly
 * "take the lock before anything else, give it back after everything else".
 */
export function holdsAdvisoryLock(key: number, mode: LockMode, onRelease?: () => Promise<void>): void {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await acquireAdvisoryLock(key, mode, onRelease);
  });

  afterAll(async () => {
    await release?.();
    release = null;
  });
}

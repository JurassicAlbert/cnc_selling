/**
 * Vitest `globalSetup` - runs in the main process, once, around the whole
 * run rather than around each file.
 *
 * That timing is the entire point. Everything else in `tests/integration`
 * cleans up after itself in an `afterEach` or an `afterAll`, which is right
 * for rows it created and nobody else can see, and wrong for a row the rest
 * of the suite reads: while a file's `afterAll` runs, other files are still
 * running in other worker processes. Here nothing else is running at all.
 *
 * **T-32.** `admin-pricing.test.ts` used to delete the pricing versions it
 * published as soon as each test finished. A probe on 2026-09-09 caught one
 * of those versions being read as the active one by another connection 180
 * times before it was removed, which is what
 * `Configuration_pricingVersion_fkey` was: a worker priced something against
 * a version that stopped existing before it could write the row. So the file
 * marks its versions and leaves them, and the sweep happens here.
 *
 * Plain `pg` rather than Prisma on purpose. This is one statement in the main
 * process, and importing `@/server/db/client` would instantiate the
 * application's singleton client and its connection pool somewhere no test
 * ever asked for one.
 */

import 'dotenv/config';

import pg from 'pg';

/**
 * Marks a `PricingSettings` row as a test's to delete, written into
 * `notePl` - a field that exists for an admin's own note about a version and
 * that nothing reads. Defined here, next to the only code that acts on it,
 * and imported by the fixture that writes it.
 */
export const TEST_PRICING_NOTE_PREFIX = 'test-pricing-';

/**
 * Remove the pricing versions the suite published, now that nothing can be
 * mid-read of one.
 *
 * `isActive = false` and the `Configuration` check are both belt and braces:
 * a run that ended badly could have left a marked version active, and
 * deleting it would leave the next run with no price list at all - the very
 * failure this item is about. A version something still points at is left
 * alone for the same reason; `npm run db:reset` is what clears those.
 */
export async function teardown(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    // No database configured is a legitimate way to run `tests/unit`, which
    // is `env-setup.ts`'s guarantee too. Nothing to sweep.
    return;
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query(
      `DELETE FROM "PricingSettings" p
        WHERE p."notePl" LIKE $1
          AND p."isActive" = false
          AND NOT EXISTS (SELECT 1 FROM "Configuration" c WHERE c."pricingVersion" = p.version)`,
      [`${TEST_PRICING_NOTE_PREFIX}%`],
    );
  } catch (error) {
    // A failed sweep must not turn a green run red: it tidies rows that are
    // inert by construction, and the next run works whether or not they are
    // there. Said out loud rather than swallowed, so it cannot rot silently.
    console.warn('[global-setup] could not sweep test pricing versions:', error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

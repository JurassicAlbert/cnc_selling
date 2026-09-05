/**
 * Vitest `setupFiles` entry - runs once per test file, before that
 * file's own imports evaluate (Vitest's actual guarantee for
 * `setupFiles`, unlike relying on import-order within a test file,
 * which is fragile). Overrides `process.env.DATABASE_URL` to
 * `TEST_DATABASE_URL` *before* anything can import
 * `src/server/db/client.ts` and create its singleton `PrismaClient`.
 *
 * This is deliberately NOT a separate test-only Prisma client: it makes
 * every repository/action module's normal `import { prisma } from
 * '@/server/db/client'` transparently point at `cnc_selling_test`
 * instead, with zero dependency-injection changes anywhere. The
 * alternative (threading a Prisma client through every repository
 * function as a parameter) would be a much larger, unrelated refactor
 * of code this project never built with test-injectability in mind -
 * out of scope for adding P4. `tests/integration/setup.ts` re-exports
 * that same now-test-pointed singleton as `testPrisma`.
 *
 * Applies globally (`vitest.config.ts`'s `setupFiles`), not just to
 * `tests/integration/` - harmless for `tests/unit/*`, which are pure
 * and never read `DATABASE_URL` at all. Deliberately does NOT throw when
 * `TEST_DATABASE_URL` is missing - `tests/unit/*` must keep working with
 * no DB configured at all (`vitest.config.ts`'s own "no DB" guarantee);
 * an integration test that actually needs the override will fail on its
 * own first real query instead, with a real Postgres connection error,
 * not a global crash unrelated to what a contributor was trying to run.
 */
import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl !== undefined && testDatabaseUrl.length > 0) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

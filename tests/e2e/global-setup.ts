import { clearLoopbackRateLimits } from './rate-limit-reset';
import { describeDatabase, isTestDatabaseUrl } from './database-guard';
import { prisma } from '../../src/server/db/client';

/**
 * Clears whatever the *previous* run left behind, before any worker starts.
 *
 * The per-test reset in `fixtures.ts` handles everything inside a run; this
 * covers the counters already sitting in the database when the run begins,
 * and gives the one-line report that made the original problem findable.
 * See `rate-limit-reset.ts` for the full story.
 */
async function globalSetup(): Promise<void> {
  /*
    ARCH-03. Several specs delete rows, so the first thing this does is
    refuse to touch anything that is not visibly a test database.

    Fail closed and loud. The failure mode being guarded against is not
    exotic: an unset `TEST_DATABASE_URL` means `playwright.config.ts`'s
    override does nothing, everything quietly falls back to the development
    database, and the suite starts deleting real rows while looking entirely
    normal - which is how the development database came to hold 259 orders
    and a leftover `test-e2e-wzor` design in the first place.
  */
  const databaseUrl = process.env.DATABASE_URL;
  if (!isTestDatabaseUrl(databaseUrl)) {
    throw new Error(
      [
        `Refusing to run the e2e suite against ${describeDatabase(databaseUrl)}.`,
        'These specs create and delete real rows, so they only run against a database whose name ends in "_test".',
        'Set TEST_DATABASE_URL (see .env.example) and run `npm run db:deploy:test && npm run db:seed:test`.',
      ].join('\n'),
    );
  }
  console.log(`e2e: using ${describeDatabase(databaseUrl)}`);

  const cleared = await clearLoopbackRateLimits();
  if (cleared > 0) {
    console.log(`e2e global setup: cleared ${cleared} loopback rate-limit counter(s)`);
  }
  await prisma.$disconnect();
}

export default globalSetup;

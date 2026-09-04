import { clearLoopbackRateLimits } from './rate-limit-reset';
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
  const cleared = await clearLoopbackRateLimits();
  if (cleared > 0) {
    console.log(`e2e global setup: cleared ${cleared} loopback rate-limit counter(s)`);
  }
  await prisma.$disconnect();
}

export default globalSetup;

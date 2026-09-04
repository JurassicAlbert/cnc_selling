import 'dotenv/config';

import { prisma } from '../../src/server/db/client';

/**
 * Clear the loopback address's rate-limit counters before the suite runs.
 *
 * Found the hard way on 2026-09-04: several specs register a fresh account
 * (promoting one is the single thing no UI path can do for itself), and
 * SEC-01's `registerPerIp` rule allows ten per day. Every spec run shares one
 * IP, so after a few local runs registration starts refusing and the failure
 * looks like nothing at all - the form simply stays on `/rejestracja` with no
 * clue why. Two specs died that way before the `RateLimit` table was checked.
 *
 * CI never sees this, because it starts from an empty database, which is
 * exactly what makes it a trap: it only bites the person running the suite
 * repeatedly on their own machine.
 *
 * Scoped to the loopback keys on purpose. It resets the throttle for the
 * machine running the tests and touches nothing else, so a spec that
 * deliberately exercises rate limiting still can.
 */
async function globalSetup(): Promise<void> {
  const cleared = await prisma.rateLimit.deleteMany({
    where: {
      OR: [
        { key: { endsWith: ':::1' } },
        { key: { endsWith: ':127.0.0.1' } },
        { key: { endsWith: ':unknown' } },
      ],
    },
  });
  if (cleared.count > 0) {
    console.log(`e2e global setup: cleared ${cleared.count} loopback rate-limit counter(s)`);
  }
  await prisma.$disconnect();
}

export default globalSetup;

import 'dotenv/config';

import { prisma } from '../../src/server/db/client';

/**
 * Clear the loopback address's rate-limit counters.
 *
 * Found the hard way on 2026-09-04: several specs register a fresh account
 * (promoting one is the single thing no UI path can do for itself), and
 * SEC-01's `registerPerIp` rule allows ten per day. Every spec run shares one
 * IP, so once the allowance is gone registration starts refusing and the
 * failure looks like nothing at all - the form simply stays on
 * `/rejestracja` with no clue why. Two specs died that way before the
 * `RateLimit` table was checked.
 *
 * A single reset before the suite is not enough, which took a second
 * incident to notice. One full run performs twelve registrations - six
 * specs across two browser projects - against a limit of ten, and CI's two
 * retries multiply that again. The suite could therefore never be green,
 * whatever the code under test did. It was masked until 2026-09-04 only
 * because the mobile-safari half of the suite was failing early for an
 * unrelated reason (`upgrade-insecure-requests`, see
 * `src/server/security/headers.ts`) and never got as far as registering.
 *
 * Deliberately not solved by raising `registerPerIp`. That limit is a real
 * control with a real rationale, and moving it so a test suite fits is
 * changing the product to suit the tests.
 *
 * Scoped to the loopback keys, which are never a real customer. It resets
 * the throttle for the machine running the tests and touches nothing else,
 * so a spec that deliberately exercises rate limiting still can - there is
 * none today, and one would need its own non-loopback key anyway.
 */
export async function clearLoopbackRateLimits(): Promise<number> {
  const cleared = await prisma.rateLimit.deleteMany({
    where: {
      OR: [
        { key: { endsWith: ':::1' } },
        { key: { endsWith: ':127.0.0.1' } },
        { key: { endsWith: ':unknown' } },
      ],
    },
  });
  return cleared.count;
}

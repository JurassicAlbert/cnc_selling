import { test as base } from '@playwright/test';

import { clearLoopbackRateLimits } from './rate-limit-reset';

/**
 * `test` with the loopback rate-limit counters cleared before every test.
 *
 * Import this instead of `@playwright/test` in any spec that registers an
 * account. `rate-limit-reset.ts` explains why once per suite is not enough:
 * a full run needs more registrations than SEC-01 allows one IP in a day, so
 * without this the later specs fail silently and the suite can never be
 * green.
 *
 * An `auto` fixture rather than a `beforeEach` in each file: the reset has
 * to happen for every test in the file including ones added later, and a
 * hook someone forgets to copy is how this class of problem returns.
 */
// The fixture's value is a `boolean` nobody reads, rather than Playwright's
// usual `void`, only to keep `noConfusingVoidType` quiet. The empty
// destructuring pattern is not negotiable: Playwright parses this parameter
// to work out which other fixtures this one depends on, and rejects a plain
// identifier outright ("First argument must use the object destructuring
// pattern"). An `auto` fixture runs for its side effect, not its value.
export const test = base.extend<{ readonly clearedRateLimits: boolean }>({
  clearedRateLimits: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructuring pattern here, and this fixture depends on nothing
    async ({}, use) => {
      await clearLoopbackRateLimits();
      await use(true);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

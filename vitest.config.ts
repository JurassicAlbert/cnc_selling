import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Domain tests (tests/unit) are pure: no DB, no network, no
    // framework. They must stay fast enough to run on every save.
    // tests/integration (added for P4) genuinely needs a real Postgres -
    // see tests/integration/env-setup.ts for how it points at
    // TEST_DATABASE_URL without any DB access from tests/unit.
    //
    // Raised from 5s to 20s on 2026-08-31, while adding CI (ARCH-01).
    //
    // This is a **deadline, not a budget**: a passing test finishes when it
    // finishes, so a longer value costs nothing except how long a genuinely
    // hung test waits before failing. The 5s value had started producing
    // false failures - `create-order.test.ts` needs ~4.1s of test time on
    // its own, and under the full suite's parallel contention for one
    // Postgres it tipped over the line. That failure carries no information
    // ("the machine was busy"), and a CI that is intermittently red for no
    // reason is a CI people learn to ignore, which would undo the point of
    // adding it.
    //
    // Deliberately not a per-tier split: `tests/unit` has no reason to
    // approach even 1s, so the looser deadline never applies to it in
    // practice, and one config value is easier to reason about than two.
    // The one test that genuinely needs longer still says so explicitly
    // (`starting-price.test.ts`, 60s, for a deliberately exhaustive sweep).
    testTimeout: 20_000,
    setupFiles: ['./tests/integration/env-setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

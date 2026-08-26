import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Domain tests (tests/unit) are pure: no DB, no network, no
    // framework. They must stay fast enough to run on every save.
    // tests/integration (added for P4) genuinely needs a real Postgres —
    // see tests/integration/env-setup.ts for how it points at
    // TEST_DATABASE_URL without any DB access from tests/unit.
    testTimeout: 5_000,
    setupFiles: ['./tests/integration/env-setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

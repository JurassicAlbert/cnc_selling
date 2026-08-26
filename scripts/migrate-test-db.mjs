// Applies pending migrations to the integration-test database
// (TEST_DATABASE_URL), by re-invoking `prisma migrate deploy` with
// DATABASE_URL programmatically overridden — not shell env-var
// substitution (`$VAR`/`%VAR%`), which differs between POSIX shells and
// Windows cmd and would make this script non-portable. See
// `tests/integration/setup.ts` for why this database needs to exist at
// all (real Postgres, per-test transaction rollback, per
// `docs/ARCHITECTURE.md` §21.1's "Integration: Vitest + real Postgres").
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
  console.error('TEST_DATABASE_URL is not set — check your .env');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

process.exit(result.status ?? 1);

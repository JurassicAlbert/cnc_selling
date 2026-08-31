// Seeds the integration-test database (TEST_DATABASE_URL), by re-invoking
// `prisma db seed` with DATABASE_URL programmatically overridden — the exact
// mirror of `scripts/migrate-test-db.mjs`, and for the same portability
// reason: shell env-var substitution (`$VAR` / `%VAR%`) differs between
// POSIX shells and Windows cmd.
//
// This exists because several integration tests sweep *the seeded
// catalogue* rather than fixtures of their own — `offered-is-buildable`
// prices every offered combination of every active product, and
// `starting-price` exhaustively searches for the cheapest buildable one. On
// an unseeded database those iterate nothing and pass vacuously, which is
// worse than failing. Adding a test database to CI (ARCH-01) made that
// failure mode reachable for the first time, so the seed step needed a
// command rather than a remembered incantation.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
  console.error('TEST_DATABASE_URL is not set — check your .env');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'db', 'seed'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

process.exit(result.status ?? 1);

// Wipes the test database back to a freshly-migrated, freshly-seeded state -
// `docs/AI-CHECKLIST.md` ARCH-03's "add `npm run db:reset`".
//
// It exists because the e2e suite writes real rows and does not clean up all
// of them: an order placed by `checkout.spec.ts` is a real order, and the
// specs that do delete only remove the accounts they created. Left alone, the
// test database accumulates the same way the development one did (259 orders,
// 466 configurations, a leftover `test-e2e-wzor` design) - only now it happens
// somewhere it does no harm and can be cleared in one command.
//
// The seed is its own step rather than something `prisma migrate reset` is
// trusted to do. Under Prisma 7.9.1 it does not: `migrate reset --help` lists
// only `--config`, `--schema` and `--force`, `--skip-seed` is rejected as an
// unknown option, and the command says nothing about seeding. Measured
// 2026-09-05, when the reset succeeded and left a schema holding zero
// products, zero categories and zero designs.
//
// An unseeded test database is the worst of the three outcomes, because it
// does not fail: `offered-is-buildable` and `starting-price` sweep the seeded
// catalogue, so with nothing to sweep they iterate nothing and pass vacuously
// (see `seed-test-db.mjs`'s own note). So the seed runs as its own step, and
// its exit code is checked.
//
// Re-applying every migration from zero is worth having as a side effect: it
// is the only routine check that the migration chain still works from empty,
// which is what CI does on every run.
//
// DATABASE_URL is overridden programmatically rather than through shell
// env-var substitution (`$VAR` / `%VAR%`), which differs between POSIX shells
// and Windows cmd - same reasoning as `migrate-test-db.mjs`.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
  console.error('TEST_DATABASE_URL is not set - check your .env');
  process.exit(1);
}

// The guard that matters. This command drops every table it can see, so it
// runs only against a database whose name says it is a test database - the
// same rule `tests/e2e/database-guard.ts` applies to the suite itself.
const databaseName = (() => {
  try {
    return new URL(testDatabaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

if (!/[_-]test$/.test(databaseName)) {
  console.error(
    `Refusing to reset "${databaseName || testDatabaseUrl}": this drops every table, so it only runs against a database whose name ends in "_test".`,
  );
  process.exit(1);
}

console.log(`Resetting ${databaseName} (drop, migrate, seed)...`);

const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

for (const args of [
  ['prisma', 'migrate', 'reset', '--force'],
  ['prisma', 'db', 'seed'],
]) {
  const step = spawnSync('npx', args, { stdio: 'inherit', shell: true, env });
  if (step.status !== 0) {
    console.error(`
"${args.join(' ')}" failed - stopping here rather than leaving a half-reset database.`);
    process.exit(step.status ?? 1);
  }
}

console.log(`${databaseName} is reset and seeded.`);

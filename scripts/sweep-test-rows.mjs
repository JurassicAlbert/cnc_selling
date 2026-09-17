/**
 * Remove e2e residue from a development database.
 *
 * `docs/AI-CHECKLIST.md` T-35. The development catalogue accumulated rows the
 * e2e suite created and never cleaned up: **783 users on `@example.test`, 91
 * orders, and five catalogue fixtures**, against five real users and seven
 * real products.
 *
 * **Why it accumulated is now known, and is fixed separately.**
 * `playwright.config.ts` used to serve the suite on port 3000, the same port
 * as `next dev`, and `reuseExistingServer` adopts an already-running server
 * exactly as it is - including whatever database it was started with. So any
 * run started while a dev server happened to be up went straight at the
 * development database. The e2e server now has its own port (3100), pinned by
 * `tests/unit/e2e-server-port.test.ts`, so this script is cleaning up after a
 * hole that is closed rather than bailing out a leaking boat.
 *
 * **Dry run unless you pass `--apply`.** It prints exactly what it would
 * remove and changes nothing.
 *
 * ## What it deliberately does NOT touch
 *
 * Only `@example.test` accounts and orders, plus the five named catalogue
 * fixtures. That domain is reserved for testing by RFC 6761, no seed writes
 * it, and every current e2e spec uses it - so it is unambiguous.
 *
 * It leaves **every `@example.com` row alone**, and that is a judgement call
 * rather than an oversight. Older runs used that domain, so a lot of it is
 * residue too - but `klient@example.com` and `panel@example.com` look exactly
 * like accounts a person signs into to look around the panel, and
 * `jan.kowalski@example.com` carries order 2026/08/0001. Telling those apart
 * needs the owner's eye, and "it doesn't delete what is helpful" was the
 * condition this sweep was authorised under. A second pass can always be run;
 * a deleted row cannot be un-deleted.
 *
 * Deletion order is explicit because it has to be: none of the optional
 * `User` relations declare `onDelete`, so Prisma's default is `SetNull` -
 * deleting a user would silently orphan their carts, configurations and
 * orders rather than remove them. Everything runs in one transaction, so a
 * foreign key nobody anticipated rolls the whole thing back instead of
 * leaving the database half-swept.
 */

import 'dotenv/config';
import pg from 'pg';

const TEST_EMAIL_PATTERN = '%@example.test';

/**
 * The five fixtures T-35 names, by their natural keys rather than by id.
 *
 * **An ordered list, not a map, and the first dry run is why.** `Product`
 * has to go before `Category`: the fixture product sits in the fixture
 * category, `Product.categoryId` is a required relation with no `onDelete`,
 * and Postgres refused the whole transaction rather than let a dangling row
 * through. Everything below that is safe in any order - the join tables
 * (`ProductMaterial`, `MaterialFinish`, `ProductDesign`, `DesignMaterial`)
 * all declare `onDelete: Cascade` - but the list stays explicit rather than
 * relying on that.
 */
const FIXTURES = [
  ['Product', 'slug', ['test-e2e-produkt']],
  ['Category', 'slug', ['test-e2e-kategoria']],
  ['Design', 'code', ['WZR-E2E-001']],
  ['Finish', 'slug', ['test-e2e-finish']],
  ['Material', 'slug', ['test-e2e-material']],
];

const apply = process.argv.includes('--apply');

async function main() {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error('DATABASE_URL is not set.');
  }
  const name = url.split('/').pop()?.split('?')[0] ?? '';
  if (name.endsWith('_test')) {
    throw new Error(
      `Refusing to sweep ${name}: the test database is supposed to hold fixtures. Re-seed it with \`npm run db:seed:test\` instead.`,
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log(`Sweeping ${name}${apply ? '' : ' (DRY RUN - nothing will be deleted)'}\n`);

  const users = await client.query(`SELECT id FROM "User" WHERE email LIKE $1`, [TEST_EMAIL_PATTERN]);
  const userIds = users.rows.map((row) => row.id);
  console.log(`  ${userIds.length} accounts on @example.test`);

  /*
    Ordered children-first. `CartItem.configurationId` is required with no
    `onDelete`, so a Configuration cannot go while a line still points at it;
    `Order` is matched on BOTH its own email and its user, because a guest
    checkout carries no `userId` at all and a signed-in one carries no
    distinguishing email of its own.
  */
  const steps = [
    ['CartItem', `DELETE FROM "CartItem" WHERE "cartId" IN (SELECT id FROM "Cart" WHERE "userId" = ANY($1::text[]))`],
    ['Cart', `DELETE FROM "Cart" WHERE "userId" = ANY($1::text[])`],
    ['Order', `DELETE FROM "Order" WHERE email LIKE '${TEST_EMAIL_PATTERN}' OR "userId" = ANY($1::text[])`],
    ['CustomerDesign', `DELETE FROM "CustomerDesign" WHERE "userId" = ANY($1::text[])`],
    ['Configuration', `DELETE FROM "Configuration" WHERE "userId" = ANY($1::text[])`],
    ['SupportRequest', `DELETE FROM "SupportRequest" WHERE "userId" = ANY($1::text[])`],
    ['User', `DELETE FROM "User" WHERE id = ANY($1::text[])`],
  ];

  await client.query('BEGIN');
  try {
    const counted = [];
    for (const [label, sql] of steps) {
      const result = await client.query(sql, [userIds]);
      counted.push([label, result.rowCount]);
    }
    for (const [table, column, values] of FIXTURES) {
      const result = await client.query(`DELETE FROM "${table}" WHERE "${column}" = ANY($1::text[])`, [values]);
      counted.push([`${table} (fixture)`, result.rowCount]);
    }

    /*
      **Checked inside the transaction, before anything is committed.** The
      condition this sweep was authorised under was "if it doesn't delete what
      is helpful", and the honest way to meet that is to prove it rather than
      to reason about the predicate. A wrong `LIKE` that swallowed the owner's
      admin account, or a cascade nobody expected taking the real catalogue
      with a fixture category, fails here and rolls the whole thing back.
    */
    const survivors = [
      ['the owner admin', `SELECT count(*)::int AS n FROM "User" WHERE email = $1`, [process.env.SEED_ADMIN_EMAIL ?? ''], 1],
      ['non-test users', `SELECT count(*)::int AS n FROM "User" WHERE email NOT LIKE '${TEST_EMAIL_PATTERN}'`, [], 5],
      ['real products', `SELECT count(*)::int AS n FROM "Product" WHERE slug NOT LIKE 'test-%'`, [], 7],
      ['real categories', `SELECT count(*)::int AS n FROM "Category" WHERE slug NOT LIKE 'test-%'`, [], 7],
      ['real materials', `SELECT count(*)::int AS n FROM "Material" WHERE slug NOT LIKE 'test-%'`, [], 5],
      ['non-test orders', `SELECT count(*)::int AS n FROM "Order" WHERE email NOT LIKE '${TEST_EMAIL_PATTERN}'`, [], 197],
    ];
    for (const [label, sql, params, expected] of survivors) {
      const { rows } = await client.query(sql, params);
      const actual = rows[0].n;
      if (actual !== expected) {
        throw new Error(`${label}: expected ${expected} to survive, found ${actual}. Refusing to commit.`);
      }
      console.log(`  survives: ${label} (${actual})`);
    }

    console.log('');
    let total = 0;
    for (const [label, n] of counted) {
      total += n;
      if (n > 0) console.log(`  ${String(n).padStart(5)}  ${label}`);
    }
    console.log(`  ${String(total).padStart(5)}  TOTAL\n`);

    if (apply) {
      await client.query('COMMIT');
      console.log('Committed.');
    } else {
      await client.query('ROLLBACK');
      console.log('Rolled back - this was a dry run. Pass --apply to delete.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nRolled back, nothing was deleted:\n', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();

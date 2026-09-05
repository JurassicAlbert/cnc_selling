/**
 * `docs/AI-CHECKLIST.md` ARCH-03 - the e2e suite ran against the
 * **development** database, which is why that database holds 259 orders, 466
 * configurations and a leftover `test-e2e-wzor` design.
 *
 * Pointing it elsewhere is one line. The part worth testing is the guard that
 * comes with it, because several specs delete rows: `admin-pagination.spec.ts`
 * removes the accounts it promotes, `warehouse.spec.ts` clears stock batches,
 * `global-setup.ts` deletes rate-limit counters. Run against the wrong
 * database, that is data loss rather than a failing test - and the way it
 * would happen is mundane: a missing `TEST_DATABASE_URL`, so the override
 * silently does nothing and everything falls back to `DATABASE_URL`.
 *
 * So the suite refuses to start unless it can see it is talking to a test
 * database. Fail closed, and say which database it found.
 */

import { describe, expect, it } from 'vitest';

import { describeDatabase, isTestDatabaseUrl } from '../e2e/database-guard';

describe('isTestDatabaseUrl', () => {
  it('accepts the project’s own test database', () => {
    expect(isTestDatabaseUrl('postgresql://cnc:pw@127.0.0.1:5433/cnc_selling_test?schema=public')).toBe(true);
  });

  it('refuses the development database', () => {
    // The whole point. This is the URL in `.env`, and the one the suite was
    // using until 2026-09-05.
    expect(isTestDatabaseUrl('postgresql://cnc:pw@127.0.0.1:5433/cnc_selling?schema=public')).toBe(false);
  });

  it('refuses a database whose name merely contains "test" somewhere', () => {
    // „latest" ends in "test". Matching a substring would accept a production
    // database called `contest_live`, which is exactly the kind of near-miss
    // a guard like this exists to catch.
    expect(isTestDatabaseUrl('postgresql://u:p@host:5432/latest')).toBe(false);
    expect(isTestDatabaseUrl('postgresql://u:p@host:5432/testing_grounds')).toBe(false);
  });

  it('accepts a name ending in the separator plus test, whichever separator', () => {
    expect(isTestDatabaseUrl('postgresql://u:p@host:5432/shop_test')).toBe(true);
    expect(isTestDatabaseUrl('postgresql://u:p@host:5432/shop-test')).toBe(true);
  });

  it.each([undefined, '', 'not-a-url', 'postgresql://u:p@host:5432/'])(
    'refuses %p rather than guessing',
    (value) => {
      // Fail closed: an unset or unparseable value must never read as "fine".
      expect(isTestDatabaseUrl(value)).toBe(false);
    },
  );
});

describe('describeDatabase', () => {
  it('names the database and host without leaking the password', () => {
    // This ends up in a console line and in CI logs.
    const described = describeDatabase('postgresql://cnc:hunter2@127.0.0.1:5433/cnc_selling_test?schema=public');

    expect(described).toContain('cnc_selling_test');
    expect(described).toContain('127.0.0.1');
    expect(described).not.toContain('hunter2');
  });

  it('says so plainly when there is nothing to describe', () => {
    expect(describeDatabase(undefined)).toBe('(not set)');
    expect(describeDatabase('not-a-url')).toBe('(unparseable)');
  });
});

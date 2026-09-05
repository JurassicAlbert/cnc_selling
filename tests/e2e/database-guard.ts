/**
 * Which database the e2e suite is allowed to touch - `docs/AI-CHECKLIST.md`
 * ARCH-03.
 *
 * The suite used to run against the **development** database, because
 * `playwright.config.ts` started the app with `npm run start` and nothing
 * overrode `DATABASE_URL`. That is why the development database holds 259
 * orders, 466 configurations and a leftover `test-e2e-wzor` design: every
 * local run wrote real rows into the data the owner also browses.
 *
 * Several specs delete rows - `admin-pagination.spec.ts` removes the accounts
 * it promotes, `warehouse.spec.ts` clears stock batches, `global-setup.ts`
 * deletes rate-limit counters. Against the wrong database that is data loss
 * rather than a red test, and the way it would happen is entirely mundane: an
 * unset `TEST_DATABASE_URL`, so the override quietly does nothing and
 * everything falls back to the development URL.
 *
 * Hence a guard that fails closed. Pure, so it can be tested without a
 * database.
 */

/**
 * True only for a database whose name ends in a separator followed by
 * `test`.
 *
 * Deliberately not a substring match. „latest" ends in the letters t-e-s-t,
 * and a production database called `contest_live` contains them - a guard
 * that accepted either would be worse than none, because it would look like
 * protection.
 */
export function isTestDatabaseUrl(url: string | undefined): boolean {
  const name = databaseNameOf(url);
  return name !== null && /[_-]test$/.test(name);
}

function databaseNameOf(url: string | undefined): string | null {
  if (url === undefined || url.length === 0) {
    return null;
  }
  try {
    const name = new URL(url).pathname.replace(/^\//, '');
    return name.length === 0 ? null : name;
  } catch {
    return null;
  }
}

/**
 * A human-readable "which database is this" for the console line the suite
 * prints on startup.
 *
 * The name and host only. This goes into CI logs, and a connection string
 * carries a password.
 */
export function describeDatabase(url: string | undefined): string {
  if (url === undefined || url.length === 0) {
    return '(not set)';
  }
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, '');
    return `${name.length === 0 ? '(no database in url)' : name} on ${parsed.hostname}:${parsed.port}`;
  } catch {
    return '(unparseable)';
  }
}

/**
 * The half of SEC-04 that no runtime test can reach.
 *
 * `tests/integration/admin-authorization.test.ts` drives `refuseUnlessAdmin`
 * through the real `apply*` functions against real Postgres. It cannot touch
 * the `xxx()` wrapper, because `requireAdminSession()` reads `next/headers`,
 * which throws outside a request scope - and the wrapper is the gate an
 * actual HTTP request meets. So the wrapper is asserted mechanically here,
 * the same way `server-action-boundary.test.ts` asserts the `actions/` ↔
 * `operations/` split rather than trusting convention.
 *
 * What this catches: someone "simplifying" one of these back to
 * `requireStaffSession()` to match its 22 neighbours. The integration test
 * would stay green - the `apply` check still refuses a `STAFF` actor - while
 * the panel had quietly reopened the screen to every staff account.
 *
 * Asserted per **function**, not per file: `admin-pricing.ts` correctly
 * contains both gates, because `simulatePricingDraft` is a read and reads
 * are `STAFF`. A file-level rule would have had to be either wrong or
 * weakened to accommodate that.
 *
 * **Rewritten 2026-09-05 for P2-9**, when the owner settled the question
 * `OPEN_ITEMS.md` §7 had been holding open since 2026-08-29: "admin is the
 * only person doing changes on admin panel we dont have superadmin for now".
 * `ARCHITECTURE.md` §16.3 had always said `STAFF` gets the catalogue
 * read-only and §16.2's matrix listed "`STAFF` → catalogue write → 403";
 * the code gave `STAFF` 84 of the 95 mutating wrappers. The docs were right.
 *
 * The rule below is now **discovered rather than listed**. A hand-maintained
 * allowlist of 8 was reasonable when 8 was the exception; as the rule for
 * all 95 it would be a list nobody updates, and the operation somebody adds
 * next month is exactly the one that would be missing from it. So the test
 * finds the wrappers itself - an exported non-`apply` function in
 * `operations/admin-*.ts` that calls an `apply*` is a mutating wrapper by
 * construction - and requires every one of them to gate on
 * `requireAdminSession()`.
 *
 * Reads keep `requireStaffSession()`, which is the whole content of
 * "read-only": a `STAFF` account can still open every panel screen and see
 * everything on it. `admin-global-search.ts` is the clearest case and stays
 * exactly as it is.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OPERATIONS_DIR = fileURLToPath(new URL('../../src/server/operations', import.meta.url));

/**
 * Every mutating wrapper in `operations/admin-*.ts`, found rather than
 * listed: an exported function that is not itself an `apply*` and that calls
 * one is the thin wrapper a Server Action reaches, and it is the gate a real
 * request meets.
 *
 * Deliberately not a curated list. See this file's header: the operation
 * added next month is the one a list would be missing.
 */
function mutatingWrappers(): readonly (readonly [string, string])[] {
  const found: (readonly [string, string])[] = [];

  for (const fileName of readdirSync(OPERATIONS_DIR).sort()) {
    if (!fileName.startsWith('admin-') || !fileName.endsWith('.ts')) {
      continue;
    }
    const source = withoutComments(readFileSync(`${OPERATIONS_DIR}/${fileName}`, 'utf8'));

    for (const declaration of source.split(/(?=\nexport (?:async )?function )/)) {
      const name = /^\nexport (?:async )?function (\w+)/.exec(declaration)?.[1];
      if (name === undefined || name.startsWith('apply')) {
        continue;
      }
      if (/\bapply[A-Z]\w*\s*\(/.test(declaration)) {
        found.push([fileName, name] as const);
      }
    }
  }

  return found;
}

/** Comments are prose about the gate, not the gate. Strip them before matching. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function bodyOf(fileName: string, functionName: string): string {
  const source = withoutComments(readFileSync(`${OPERATIONS_DIR}/${fileName}`, 'utf8'));
  const start = source.indexOf(`export async function ${functionName}(`);
  if (start === -1) {
    throw new Error(`${fileName} has no exported function ${functionName}`);
  }
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('every mutating panel operation is ADMIN-only (P2-9)', () => {
  const wrappers = mutatingWrappers();

  it('finds the wrappers at all - a rule that matched nothing would pass silently', () => {
    // The failure mode of a discovered rule: a refactor renames `apply*` or
    // moves the files, the scan returns an empty list, and 95 assertions
    // quietly become zero while the suite stays green. There were 95 on
    // 2026-09-05; the floor is deliberately well below that so ordinary
    // additions and removals do not trip it.
    expect(wrappers.length).toBeGreaterThan(80);
  });

  it.each(wrappers)('%s → %s() gates on requireAdminSession', (file, fn) => {
    const body = bodyOf(file, fn);

    expect(body).toMatch(/requireAdminSession\s*\(/);
    expect(body, `${file} → ${fn}() falls back to requireStaffSession()`).not.toMatch(
      /requireStaffSession\s*\(/,
    );
  });
});

describe('the three SEC-04 operations also assert the role inside the apply', () => {
  // Belt and braces, and the thing that makes the integration test possible
  // at all. Listed separately because the three older admin-only operations
  // predate this convention and are not being retrofitted here - that would
  // be scope creep on a security fix, which is how security fixes get
  // delayed.
  const SEC_04 = [
    ['admin-store-settings.ts', 'applyUpdateStoreSettings'],
    ['admin-customers.ts', 'applyAnonymizeCustomer'],
    ['admin-email-templates.ts', 'applyUpdateEmailTemplate'],
  ] as const;

  it.each(SEC_04)('%s → %s() calls refuseUnlessAdmin', (file, fn) => {
    expect(bodyOf(file, fn)).toContain('refuseUnlessAdmin(');
  });

  it.each(SEC_04)('%s → %s() checks the role before it reads or writes anything', (file, fn) => {
    const body = bodyOf(file, fn);
    const guardAt = body.indexOf('refuseUnlessAdmin(');
    const firstDbCall = body.search(/\bprisma\.\w+\.\w+\(/);

    expect(guardAt).toBeGreaterThan(-1);
    expect(firstDbCall).toBeGreaterThan(-1);
    // A check that runs after the write returns a refusal to a caller whose
    // bank account has already been changed.
    expect(guardAt).toBeLessThan(firstDbCall);
  });
});

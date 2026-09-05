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
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OPERATIONS_DIR = fileURLToPath(new URL('../../src/server/operations', import.meta.url));

/**
 * Every mutating wrapper `ARCHITECTURE.md` §16.3 assigns to `ADMIN`, with
 * the reason recorded so a future reader can weigh a change rather than
 * guess at one.
 */
const ADMIN_ONLY_WRAPPERS = [
  ['admin-store-settings.ts', 'updateStoreSettings', 'writes the bank account customers are told to pay into'],
  ['admin-customers.ts', 'anonymizeCustomer', 'irreversibly anonymizes a customer and revokes their sign-in'],
  ['admin-email-templates.ts', 'updateEmailTemplate', 'rewrites customer-facing email, verification-otp included'],
  ['admin-staff.ts', 'inviteStaffUser', 'creates staff accounts'],
  ['admin-staff.ts', 'changeStaffRole', 'grants and revokes ADMIN'],
  ['admin-pricing.ts', 'createPricingDraft', 'writes the pricing every order is priced against'],
  ['admin-pricing.ts', 'publishPricingVersion', 'makes a pricing draft live for every customer'],
  ['admin-analytics.ts', 'pruneAnalyticsEvents', 'permanently deletes analytics history'],
] as const;

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

describe('mutating operations that §16.3 assigns to ADMIN', () => {
  it.each(ADMIN_ONLY_WRAPPERS)('%s → %s() gates on requireAdminSession - it %s', (file, fn, _why) => {
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

/**
 * T-09 - `docs/REVIEW-DETAILED.md` SEC-04. `ARCHITECTURE.md` §16.3 gives
 * `STAFF` "customers (**read**)" and assigns settings to `ADMIN`. Three
 * operations did not honour that:
 *
 * 1. `applyUpdateStoreSettings` writes `StoreSettings.bankAccountNumber` -
 *    the account number every bank-transfer customer is told to pay into.
 * 2. `applyAnonymizeCustomer` irreversibly scrubs a user's identity and
 *    deletes their `Session`/`Account` rows.
 * 3. `applyUpdateEmailTemplate` rewrites customer-facing email, including
 *    `verification-otp`.
 *
 * **Why the check has to live in the `apply` half, and is tested there.**
 * The `xxx()` wrapper's `requireAdminSession()` is the gate a real request
 * meets, and it is the right place for it - but it calls `next/headers`,
 * which throws outside a request scope, so no test in this suite can reach
 * it (`tests/integration/authz.test.ts`'s header records the same
 * constraint). A rule that only exists somewhere untestable is exactly the
 * shape of SEC-03, where compatibility was enforced for rendering and not
 * for writing. So each `apply` now asserts the actor's role itself, which
 * is both defense in depth and the only version of this rule a test can
 * drive. `tests/unit/admin-only-operations.test.ts` covers the wrapper half
 * mechanically.
 *
 * **No transaction rollback**, for the reason `authz.test.ts` documents:
 * these operations use the app's own `prisma` singleton, so a row written
 * inside an uncommitted interactive transaction would be invisible to them.
 * Real writes, explicit restore.
 *
 * **Every read-and-restore is scoped to a single test**, deliberately, and
 * not hoisted into `beforeAll`/`afterAll`. Two of the rows here are
 * singletons the whole application shares - `StoreSettings` row 1 and the
 * `verification-otp` `EmailTemplate` - and `admin-store-settings.test.ts` /
 * `admin-email-templates.test.ts` legitimately write the same two rows.
 * Vitest runs files in parallel, so a snapshot taken once at the top of this
 * file can be **another file's in-flight test value**, and comparing against
 * it later fails for a reason that has nothing to do with the code under
 * test. (That was not hypothetical: this file flaked exactly that way on the
 * first full-suite run after it was added.) Reading immediately before the
 * call and comparing immediately after asserts the thing actually meant -
 * *this call changed nothing* - and is true regardless of what any other
 * file is doing.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { acquireSingletonLock } from './singleton-lock';
import { applyAnonymizeCustomer } from '@/server/operations/admin-customers';
import { applyUpdateEmailTemplate } from '@/server/operations/admin-email-templates';
import { applyUpdateStoreSettings } from '@/server/operations/admin-store-settings';

const PREFIX = 'test-sec04-';

function actor(role: CurrentSession['role']): CurrentSession {
  return {
    userId: `${PREFIX}${role.toLowerCase()}`,
    role,
    name: `Test ${role}`,
    email: `${PREFIX}${role.toLowerCase()}@example.test`,
  };
}

const STAFF = actor('STAFF');
const ADMIN = actor('ADMIN');
const CUSTOMER = actor('CUSTOMER');

/** Everyone who must be refused. ADMIN is asserted separately, per case. */
const REFUSED = [
  ['STAFF', STAFF],
  ['CUSTOMER', CUSTOMER],
] as const;

const TEMPLATE_KEY = 'verification-otp';

type StoreSettingsFields = {
  bankAccountNumber: string | null;
  bankAccountHolderPl: string | null;
  shippingFlatRateGrosze: number;
  updatedByEmail: string | null;
};

async function readStoreSettings(): Promise<StoreSettingsFields> {
  const row = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    bankAccountNumber: row.bankAccountNumber,
    bankAccountHolderPl: row.bankAccountHolderPl,
    shippingFlatRateGrosze: row.shippingFlatRateGrosze,
    updatedByEmail: row.updatedByEmail,
  };
}

type TemplateFields = { subjectPl: string; bodyPl: string; updatedByEmail: string | null };

async function readTemplate(): Promise<TemplateFields> {
  const row = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: TEMPLATE_KEY } });
  return { subjectPl: row.subjectPl, bodyPl: row.bodyPl, updatedByEmail: row.updatedByEmail };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { contains: PREFIX } } });
});

async function auditRowsByTestActors(): Promise<number> {
  return prisma.auditLog.count({ where: { actorEmail: { startsWith: PREFIX } } });
}


/*
  Serialised against every other file that writes these shared singleton rows
  - see `singleton-lock.ts`. Held for the whole file rather than per test:
  the requirement is that no other file writes the row while this one is
  reading its own value back, and a per-test lock would leave the gaps
  between them open.
*/
let releaseSingletonLock: (() => Promise<void>) | null = null;

beforeAll(async () => {
  releaseSingletonLock = await acquireSingletonLock();
});

afterAll(async () => {
  await releaseSingletonLock?.();
  releaseSingletonLock = null;
});

describe('applyUpdateStoreSettings - the bank account every customer is told to pay into', () => {
  const INPUT = {
    bankAccountNumber: 'PL61109010140000071219812874',
    bankAccountHolderPl: 'Test SEC-04',
    // UX-22's re-typed confirmation. Matching, because this test is about
    // who may write the field, not about how it is validated.
    bankAccountNumberConfirmation: 'PL61 1090 1014 0000 0712 1981 2874',
    shippingFlatRateGrosze: 1234,
    // Blank: what this test is about is the authorization gate, not the
    // social-profile fields added on 2026-09-04.
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
  };

  /**
   * Values no other test writes, so "did the refused call land?" can be
   * answered without reading any other writer's value as a failure.
   *
   * Rewritten 2026-09-05. This used to snapshot the whole row, call the
   * refused operation and assert the row was unchanged - which is the right
   * *idea* and the wrong *assertion*, because `StoreSettings` is a singleton
   * that `admin-store-settings.test.ts` legitimately writes, Vitest runs
   * files in parallel, and a value that arrives between the two reads fails
   * this test for a reason that has nothing to do with authorization. Run
   * together, the two files failed four times out of four.
   *
   * This file's own header already warned about exactly that hazard and
   * prescribed reading immediately before and comparing immediately after.
   * That narrows the window; it cannot close it, because the other file's
   * write can land inside it. Asserting on values only this block uses
   * removes the window instead of shrinking it.
   */
  const REFUSED_INPUT = {
    ...INPUT,
    bankAccountNumber: 'PL27114020040000300201355387',
    bankAccountNumberConfirmation: 'PL27114020040000300201355387',
    bankAccountHolderPl: 'Test SEC-04 odmowa',
    shippingFlatRateGrosze: 4_321,
  };

  it.each(REFUSED)('refuses a %s actor and changes nothing', async (_role, who) => {
    const result = await applyUpdateStoreSettings(who, REFUSED_INPUT);

    expect(result.ok).toBe(false);

    // The assertion that matters: a check placed *after* the write would
    // still return ok:false while having redirected every incoming payment.
    // So what is asserted is that this call's own values are nowhere in the
    // row - true no matter what any other file has written to it meanwhile.
    const after = await readStoreSettings();
    expect(after.bankAccountNumber).not.toBe(REFUSED_INPUT.bankAccountNumber);
    expect(after.bankAccountHolderPl).not.toBe(REFUSED_INPUT.bankAccountHolderPl);
    expect(after.shippingFlatRateGrosze).not.toBe(REFUSED_INPUT.shippingFlatRateGrosze);
    expect(after.updatedByEmail).not.toBe(who.email);
  });

  it('writes no audit-log entry for a refused attempt', async () => {
    await applyUpdateStoreSettings(STAFF, INPUT);
    expect(await auditRowsByTestActors()).toBe(0);
  });

  it('allows an ADMIN actor', async () => {
    const before = await readStoreSettings();
    try {
      const result = await applyUpdateStoreSettings(ADMIN, INPUT);

      expect(result.ok).toBe(true);
      const after = await readStoreSettings();
      expect(after.bankAccountNumber).toBe(INPUT.bankAccountNumber);
      expect(after.updatedByEmail).toBe(ADMIN.email);
    } finally {
      // Restored here rather than in an `afterAll`, so the row is out of its
      // test value for as short a window as possible - see this file's
      // header on why that matters with parallel files.
      await prisma.storeSettings.update({ where: { id: 1 }, data: before });
    }
  });
});

describe('applyAnonymizeCustomer - irreversible, and §16.3 gives STAFF read only', () => {
  async function seedCustomer(): Promise<{ id: string; email: string }> {
    return prisma.user.create({
      data: { name: 'Jan Testowy', email: `${PREFIX}${crypto.randomUUID()}@example.test`, role: 'CUSTOMER' },
      select: { id: true, email: true },
    });
  }

  it.each(REFUSED)('refuses a %s actor and leaves the customer intact', async (_role, who) => {
    const customer = await seedCustomer();

    const result = await applyAnonymizeCustomer(who, customer.id, 'Wniosek RODO');

    expect(result.ok).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.email).toBe(customer.email);
    expect(after.name).toBe('Jan Testowy');
    expect(after.anonymizedAt).toBeNull();
  });

  it('allows an ADMIN actor', async () => {
    const customer = await seedCustomer();

    const result = await applyAnonymizeCustomer(ADMIN, customer.id, 'Wniosek RODO');

    expect(result.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.anonymizedAt).not.toBeNull();
    expect(after.email).not.toBe(customer.email);

    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
    await prisma.user.delete({ where: { id: customer.id } });
  });
});

describe('applyUpdateEmailTemplate - rewrites the body of customer-facing email', () => {
  const INPUT = { subjectPl: 'Temat testowy SEC-04', bodyPl: 'Treść testowa SEC-04' };

  it.each(REFUSED)('refuses a %s actor and leaves the template untouched', async (_role, who) => {
    const before = await readTemplate();

    const result = await applyUpdateEmailTemplate(who, TEMPLATE_KEY, INPUT);

    expect(result.ok).toBe(false);
    expect(await readTemplate()).toEqual(before);
  });

  it('allows an ADMIN actor', async () => {
    const before = await readTemplate();
    try {
      const result = await applyUpdateEmailTemplate(ADMIN, TEMPLATE_KEY, INPUT);

      expect(result.ok).toBe(true);
      expect((await readTemplate()).subjectPl).toBe(INPUT.subjectPl);
    } finally {
      await prisma.emailTemplate.update({ where: { key: TEMPLATE_KEY }, data: before });
    }
  });
});

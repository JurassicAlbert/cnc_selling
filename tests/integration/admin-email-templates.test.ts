import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyUpdateEmailTemplate } from '@/server/operations/admin-email-templates';
import { findEmailTemplate, listEmailTemplates } from '@/server/repositories/admin-email-templates';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { acquireSingletonLock } from './singleton-lock';

const PREFIX = 'test-admin-email-templates-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

/**
 * ADMIN, not STAFF - changed 2026-08-31 for docs/REVIEW-DETAILED.md SEC-04.
 * This operation now refuses a STAFF actor (ARCHITECTURE.md §16.3), so an
 * actor built here has to be one that is genuinely allowed to perform it;
 * the refusal itself is covered by tests/integration/admin-authorization.test.ts.
 * The name is kept as `staffActor` because every call site below reads as
 * "the acting member of staff", which an ADMIN still is.
 */
function staffActor(): CurrentSession {
  return { userId: uid(), role: 'ADMIN', name: 'Test Admin', email: `${uid()}@example.test` };
}

// EmailTemplate rows are the two real seeded singletons the whole app
// reads (mailer.ts) - snapshot and restore, don't delete.
let snapshot: { readonly key: string; readonly subjectPl: string; readonly bodyPl: string } | null = null;

afterEach(async () => {
  if (snapshot !== null) {
    await prisma.emailTemplate.update({ where: { key: snapshot.key }, data: { subjectPl: snapshot.subjectPl, bodyPl: snapshot.bodyPl } });
    snapshot = null;
  }
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});


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

describe('listEmailTemplates / findEmailTemplate', () => {
  it('returns the real seeded templates', async () => {
    const list = await listEmailTemplates();
    expect(list.some((t) => t.key === 'order-confirmation')).toBe(true);
    expect(list.some((t) => t.key === 'verification-otp')).toBe(true);

    const detail = await findEmailTemplate('order-confirmation');
    expect(detail?.subjectPl).toContain('{{orderNumber}}');
  });

  it('returns null for an unknown key', async () => {
    expect(await findEmailTemplate('does-not-exist')).toBeNull();
  });
});

describe('applyUpdateEmailTemplate', () => {
  it('rejects an empty subject or body', async () => {
    const result = await applyUpdateEmailTemplate(staffActor(), 'order-confirmation', { subjectPl: '', bodyPl: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown key', async () => {
    const result = await applyUpdateEmailTemplate(staffActor(), 'does-not-exist', { subjectPl: 'x', bodyPl: 'y' });
    expect(result.ok).toBe(false);
  });

  it('persists real edited text and audits it', async () => {
    /*
      Edits `order-status-update`, not `verification-otp`, and the new subject
      carries no `{{otp}}`. Both matter, and both were wrong until 2026-09-05.

      The old version wrote „Twój nowy kod: {{otp}}" into the OTP template's
      subject. `mailer.test.ts` asserts that a rendered OTP subject never
      contains the code - SEC-02, because a subject reaches mail-server logs
      and lock-screen previews - so while this test held that value, that one
      failed. Every spec here shares one database.

      Worse, the restore captured `existing` *before* the write and put it
      back afterwards, so once a bad value survived a run it became the value
      the next run restored to. A ratchet: measured on 2026-09-05, running
      this file alone left „Twój nowy kod: {{otp}}" in the database and still
      passed. `RESTORED_SUBJECT` below is a known-good value rather than
      whatever happened to be there.

      (`20260831010000_otp_subject_without_code` records that a *deliberately*
      customised OTP subject is the owner's editorial choice and no longer a
      leak, since the mailer stopped logging rendered text. That is about a
      choice somebody makes; this was a test leaving one behind.)
    */
    const existing = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-status-update' } });
    snapshot = { key: existing.key, subjectPl: existing.subjectPl, bodyPl: existing.bodyPl };
    const staff = staffActor();

    const result = await applyUpdateEmailTemplate(staff, 'order-status-update', {
      subjectPl: 'Zmiana statusu zamówienia {{orderNumber}}',
      bodyPl: 'Status: {{statusPl}}',
    });
    expect(result.ok).toBe(true);

    const updated = await findEmailTemplate('order-status-update');
    expect(updated?.subjectPl).toBe('Zmiana statusu zamówienia {{orderNumber}}');
    expect(await prisma.auditLog.count({ where: { entity: 'EmailTemplate', entityId: 'order-status-update', actorEmail: staff.email } })).toBe(1);
  });
});

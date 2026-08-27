import { afterEach, describe, expect, it } from 'vitest';

import { applyUpdateEmailTemplate } from '@/server/actions/admin-email-templates';
import { findEmailTemplate, listEmailTemplates } from '@/server/repositories/admin-email-templates';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-email-templates-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

// EmailTemplate rows are the two real seeded singletons the whole app
// reads (mailer.ts) — snapshot and restore, don't delete.
let snapshot: { readonly key: string; readonly subjectPl: string; readonly bodyPl: string } | null = null;

afterEach(async () => {
  if (snapshot !== null) {
    await prisma.emailTemplate.update({ where: { key: snapshot.key }, data: { subjectPl: snapshot.subjectPl, bodyPl: snapshot.bodyPl } });
    snapshot = null;
  }
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
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
    const existing = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'verification-otp' } });
    snapshot = { key: existing.key, subjectPl: existing.subjectPl, bodyPl: existing.bodyPl };
    const staff = staffActor();

    const result = await applyUpdateEmailTemplate(staff, 'verification-otp', {
      subjectPl: 'Twój nowy kod: {{otp}}',
      bodyPl: 'Kod: {{otp}}',
    });
    expect(result.ok).toBe(true);

    const updated = await findEmailTemplate('verification-otp');
    expect(updated?.subjectPl).toBe('Twój nowy kod: {{otp}}');
    expect(await prisma.auditLog.count({ where: { entity: 'EmailTemplate', entityId: 'verification-otp', actorEmail: staff.email } })).toBe(1);
  });
});

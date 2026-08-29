import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateFaq, applySetFaqActive, applyUpdateFaq } from '@/server/operations/admin-faq';
import { listActiveFaqs } from '@/server/repositories/faq';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-faq-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.faq.deleteMany({ where: { questionPl: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateFaq / applyUpdateFaq / applySetFaqActive', () => {
  it('creates, updates, and deactivates a FAQ entry, each audited', async () => {
    const staff = staffActor();
    const question = uid();

    const created = await applyCreateFaq(staff, { questionPl: question, answerPl: 'Odpowiedź', sortOrder: 0 });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    expect((await listActiveFaqs()).some((f) => f.questionPl === question)).toBe(true);

    const updated = await applyUpdateFaq(staff, created.id, { questionPl: question, answerPl: 'Zmieniona odpowiedź', sortOrder: 0 });
    expect(updated.ok).toBe(true);
    expect((await prisma.faq.findUniqueOrThrow({ where: { id: created.id } })).answerPl).toBe('Zmieniona odpowiedź');

    await applySetFaqActive(staff, created.id, false);
    expect((await listActiveFaqs()).some((f) => f.questionPl === question)).toBe(false);
    expect(await prisma.faq.findUnique({ where: { id: created.id } })).not.toBeNull();

    expect(await prisma.auditLog.count({ where: { entity: 'Faq', actorEmail: staff.email } })).toBe(3);
  });

  it('rejects an empty question or answer', async () => {
    const staff = staffActor();
    expect((await applyCreateFaq(staff, { questionPl: '', answerPl: 'x', sortOrder: 0 })).ok).toBe(false);
    expect((await applyCreateFaq(staff, { questionPl: uid(), answerPl: '', sortOrder: 0 })).ok).toBe(false);
  });
});

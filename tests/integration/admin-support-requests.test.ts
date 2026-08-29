import { afterEach, describe, expect, it } from 'vitest';

import { applyUpdateSupportRequest } from '@/server/operations/admin-support-requests';
import { findSupportRequestForAdmin, listSupportRequestsForAdmin } from '@/server/repositories/admin-support-requests';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-support-requests-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

async function seedRequest() {
  return prisma.supportRequest.create({
    data: {
      email: `${uid()}@example.test`,
      subjectPl: `${PREFIX}temat`,
      messagePl: 'Testowa wiadomość.',
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'SupportRequest', actorEmail: { startsWith: PREFIX } } });
  await prisma.supportRequest.deleteMany({ where: { subjectPl: { startsWith: PREFIX } } });
});

describe('applyUpdateSupportRequest', () => {
  it('updates status and admin notes, and audits the change', async () => {
    const staff = staffActor();
    const request = await seedRequest();

    const result = await applyUpdateSupportRequest(staff, request.id, 'IN_PROGRESS', 'Skontaktowano się z klientem.');
    expect(result.ok).toBe(true);

    const updated = await findSupportRequestForAdmin(request.id);
    expect(updated?.status).toBe('IN_PROGRESS');
    expect(updated?.adminNotesPl).toBe('Skontaktowano się z klientem.');
    expect(await prisma.auditLog.count({ where: { entity: 'SupportRequest', action: 'update', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects an invalid status', async () => {
    const request = await seedRequest();
    const result = await applyUpdateSupportRequest(staffActor(), request.id, 'NOT_A_REAL_STATUS' as never, null);
    expect(result.ok).toBe(false);
  });

  it('returns a failure result for a non-existent request', async () => {
    const result = await applyUpdateSupportRequest(staffActor(), 'does-not-exist', 'NEW', null);
    expect(result.ok).toBe(false);
  });
});

describe('listSupportRequestsForAdmin', () => {
  it('filters by status when given', async () => {
    const staff = staffActor();
    const request = await seedRequest();
    await applyUpdateSupportRequest(staff, request.id, 'RESOLVED', null);

    expect((await listSupportRequestsForAdmin({ status: 'RESOLVED' })).some((r) => r.id === request.id)).toBe(true);
    expect((await listSupportRequestsForAdmin({ status: 'NEW' })).some((r) => r.id === request.id)).toBe(false);
  });
});

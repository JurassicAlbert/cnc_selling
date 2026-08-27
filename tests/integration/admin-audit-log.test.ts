import { afterEach, describe, expect, it } from 'vitest';

import { listAuditLogEntities, listAuditLogs } from '@/server/repositories/admin-audit-log';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-audit-log-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedLog(overrides: Partial<{ entity: string; action: string; actorEmail: string; entityId: string }> = {}) {
  return prisma.auditLog.create({
    data: {
      actorEmail: overrides.actorEmail ?? `${uid()}@example.test`,
      entity: overrides.entity ?? 'TestEntity',
      entityId: overrides.entityId ?? uid(),
      action: overrides.action ?? 'update',
      diff: { note: 'test' },
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('listAuditLogs', () => {
  it('returns real rows, filterable by entity, action, and search (actorEmail or entityId)', async () => {
    const actorEmail = `${uid()}@example.test`;
    const targetId = uid();
    const seeded = await seedLog({ entity: 'TestEntityA', action: 'create', actorEmail, entityId: targetId });
    await seedLog({ entity: 'TestEntityB', action: 'delete' });

    const byEntity = await listAuditLogs({ entity: 'TestEntityA' });
    expect(byEntity.some((l) => l.id === seeded.id)).toBe(true);
    expect(byEntity.every((l) => l.entity === 'TestEntityA')).toBe(true);

    const byAction = await listAuditLogs({ action: 'create' });
    expect(byAction.some((l) => l.id === seeded.id)).toBe(true);

    const bySearchEmail = await listAuditLogs({ search: actorEmail });
    expect(bySearchEmail.map((l) => l.id)).toEqual([seeded.id]);

    const bySearchEntityId = await listAuditLogs({ search: targetId });
    expect(bySearchEntityId.map((l) => l.id)).toEqual([seeded.id]);
  });
});

describe('listAuditLogEntities', () => {
  it('reflects the real distinct entities that have been logged, self-updating', async () => {
    await seedLog({ entity: 'TestOnlyEntity' });
    const entities = await listAuditLogEntities();
    expect(entities).toContain('TestOnlyEntity');
  });
});

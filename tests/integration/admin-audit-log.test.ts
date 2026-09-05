import { afterEach, describe, expect, it } from 'vitest';

import { listAuditLogEntities, listAuditLogs, listAuditLogsForEntity } from '@/server/repositories/admin-audit-log';
import { prisma } from '@/server/db/client';

/**
 * These assert filtering, not paging - ADMIN-01 gave every admin list an
 * explicit page, so they ask for one wide enough to hold whatever they seed
 * and go on checking exactly what they always did.
 */
const FIRST_PAGE = { skip: 0, take: 100 };

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

    const byEntity = (await listAuditLogs({ entity: 'TestEntityA' }, FIRST_PAGE)).items;
    expect(byEntity.some((l) => l.id === seeded.id)).toBe(true);
    expect(byEntity.every((l) => l.entity === 'TestEntityA')).toBe(true);

    const byAction = (await listAuditLogs({ action: 'create' }, FIRST_PAGE)).items;
    expect(byAction.some((l) => l.id === seeded.id)).toBe(true);

    const bySearchEmail = (await listAuditLogs({ search: actorEmail }, FIRST_PAGE)).items;
    expect(bySearchEmail.map((l) => l.id)).toEqual([seeded.id]);

    const bySearchEntityId = (await listAuditLogs({ search: targetId }, FIRST_PAGE)).items;
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

describe('listAuditLogsForEntity', () => {
  it('returns only the given record\'s own history, newest first, ignoring other records of the same entity', async () => {
    const entityId = uid();
    const older = await seedLog({ entity: 'TestRecordEntity', entityId, action: 'create' });
    const newer = await seedLog({ entity: 'TestRecordEntity', entityId, action: 'update' });
    await seedLog({ entity: 'TestRecordEntity', entityId: uid(), action: 'update' }); // a different record, same entity
    await seedLog({ entity: 'TestOtherEntity', entityId, action: 'update' }); // same entityId, different entity

    const timeline = await listAuditLogsForEntity('TestRecordEntity', entityId);
    expect(timeline.map((l) => l.id)).toEqual([newer.id, older.id]);
  });

  it('returns an empty list for a record with no history', async () => {
    const timeline = await listAuditLogsForEntity('TestRecordEntity', uid());
    expect(timeline).toEqual([]);
  });
});

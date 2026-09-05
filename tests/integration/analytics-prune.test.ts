import { afterEach, describe, expect, it } from 'vitest';

import { applyPruneAnalyticsEvents } from '@/server/operations/admin-analytics';
import { countPrunableAnalyticsEvents, pruneOldAnalyticsEvents } from '@/server/analytics/prune';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * `docs/CHECKLIST.md`'s "12-month pruning of analytics rows" - real,
 * staff-triggered retention (no scheduler exists anywhere in this
 * project). `now` is always passed explicitly rather than read from
 * `Date.now()` internally, specifically so this is deterministically
 * testable without faking the system clock.
 */

const PREFIX = 'test-analytics-prune-';

function adminActor(): CurrentSession {
  return { userId: `${PREFIX}${crypto.randomUUID()}`, role: 'ADMIN', name: 'Test Admin', email: `${PREFIX}${crypto.randomUUID()}@example.test` };
}

async function seedEvent(createdAt: Date) {
  return prisma.analyticsEvent.create({
    data: { name: 'product_view', sessionToken: `${PREFIX}${crypto.randomUUID()}`, createdAt },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'AnalyticsEvent', actorEmail: { startsWith: PREFIX } } });
  await prisma.analyticsEvent.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

describe('countPrunableAnalyticsEvents / pruneOldAnalyticsEvents', () => {
  it('counts and deletes only events older than 12 months, leaving recent ones untouched', async () => {
    const now = new Date('2026-08-28T12:00:00Z');
    const old = await seedEvent(new Date('2025-01-01T00:00:00Z')); // > 12 months before `now`
    const recent = await seedEvent(new Date('2026-08-01T00:00:00Z')); // < 12 months before `now`

    expect(await countPrunableAnalyticsEvents(now)).toBeGreaterThanOrEqual(1);

    const { deletedCount } = await pruneOldAnalyticsEvents(now);
    expect(deletedCount).toBeGreaterThanOrEqual(1);

    expect(await prisma.analyticsEvent.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.analyticsEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it('treats an event exactly 12 months old as still retained (a strict "less than" cutoff)', async () => {
    const now = new Date('2026-08-28T12:00:00Z');
    const exactlyAtCutoff = new Date('2025-08-28T12:00:00Z');
    const event = await seedEvent(exactlyAtCutoff);

    await pruneOldAnalyticsEvents(now);

    expect(await prisma.analyticsEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it('is a no-op when nothing is old enough', async () => {
    const now = new Date('2026-08-28T12:00:00Z');
    await seedEvent(new Date('2026-08-20T00:00:00Z'));

    const { deletedCount } = await pruneOldAnalyticsEvents(now);
    expect(deletedCount).toBe(0);
  });
});

describe('applyPruneAnalyticsEvents', () => {
  it('deletes old rows and audits the count', async () => {
    const admin = adminActor();
    await seedEvent(new Date('2020-01-01T00:00:00Z'));

    const result = await applyPruneAnalyticsEvents(admin);
    expect(result.ok).toBe(true);
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);

    expect(await prisma.auditLog.count({ where: { entity: 'AnalyticsEvent', actorEmail: admin.email } })).toBe(1);
  });
});

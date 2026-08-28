/**
 * `AnalyticsEvent` retention — `docs/CHECKLIST.md`'s own "12-month pruning
 * of analytics rows" line, left unbuilt when `record-event.ts`'s write
 * path shipped (that file's own header: "the table and its 12-month
 * pruning/dashboard belong to P8"). No cron/scheduled-task infrastructure
 * exists anywhere in this project (confirmed by inspection — no queue, no
 * platform-level scheduler configured), so this is a real, staff-triggered
 * action (`/panel/ustawienia`), same "manual until real automation exists"
 * shape as the mailer's unconfigured send and the shipment status editor —
 * not a silently-skipped feature.
 */

import { prisma } from '@/server/db/client';

const RETENTION_MONTHS = 12;

function cutoffDate(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff;
}

/** How many rows a prune run right now would delete — for the confirmation UI, so a staff member isn't clicking blind. */
export async function countPrunableAnalyticsEvents(now: Date = new Date()): Promise<number> {
  return prisma.analyticsEvent.count({ where: { createdAt: { lt: cutoffDate(now) } } });
}

export async function pruneOldAnalyticsEvents(now: Date = new Date()): Promise<{ readonly deletedCount: number }> {
  const result = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoffDate(now) } } });
  return { deletedCount: result.count };
}

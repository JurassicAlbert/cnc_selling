/** Staff analytics-retention action - ADMIN-only, same gate as pricing (a real, irreversible bulk delete, not a toggle). */

import { revalidatePath } from 'next/cache';

import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { pruneOldAnalyticsEvents } from '@/server/analytics/prune';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type PruneAnalyticsResult = { readonly ok: true; readonly deletedCount: number };

export async function applyPruneAnalyticsEvents(admin: CurrentSession): Promise<PruneAnalyticsResult> {
  const { deletedCount } = await pruneOldAnalyticsEvents();
  await writeAuditLog({ actor: admin, entity: 'AnalyticsEvent', entityId: 'bulk', action: 'update', diff: { prunedOlderThan12Months: deletedCount } });
  return { ok: true, deletedCount };
}

export async function pruneAnalyticsEvents(): Promise<PruneAnalyticsResult> {
  const admin = await requireAdminSession();
  const result = await applyPruneAnalyticsEvents(admin);
  revalidatePath('/panel/ustawienia');
  return result;
}

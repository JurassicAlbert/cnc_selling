/**
 * Read-only view over `AuditLog` - every mutation across every P7b slice
 * has been writing here since `writeAuditLog()` was introduced (P7a). No
 * new schema, no new writes: this is purely "the audit log viewer" half
 * of `docs/ARCHITECTURE.md` §16A.1 module 11, the checklist's own last
 * open item.
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import type { PageRequest } from '@/domain/pagination/page';
import type { Page } from '@/server/repositories/page';

export type AdminAuditLogListFilters = {
  readonly entity?: string;
  readonly action?: string;
  /** Matches `actorEmail` (contains) or `entityId` (exact) - one search box covers both, since either is how staff will actually look something up. */
  readonly search?: string;
};

export type AdminAuditLogListItem = {
  readonly id: string;
  readonly actorEmail: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly action: string;
  readonly diff: Prisma.JsonValue | null;
  readonly createdAt: Date;
};

/**
 * ADMIN-01, and the most consequential of the three. This took the newest 200
 * entries and stopped - so the §16A.2 record of who changed what silently
 * forgot everything older, which is not a record.
 */
export async function listAuditLogs(
  filters: AdminAuditLogListFilters,
  page: Pick<PageRequest, 'skip' | 'take'>,
): Promise<Page<AdminAuditLogListItem>> {
  const where = {
    entity: filters.entity,
    action: filters.action,
    ...(filters.search !== undefined && filters.search.length > 0
      ? {
          OR: [
            { actorEmail: { contains: filters.search, mode: 'insensitive' as const } },
            { entityId: filters.search },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
      select: { id: true, actorEmail: true, entity: true, entityId: true, action: true, diff: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}

/** Populates the entity filter dropdown from what's actually been written - self-updating as new slices add new entities, never a hardcoded list that drifts. */
export async function listAuditLogEntities(): Promise<readonly string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } });
  return rows.map((r) => r.entity);
}

const RECORD_ACTIVITY_LIMIT = 100;

/**
 * A single record's full mutation history - the "activity timeline"
 * embedded on each entity's own admin detail page, distinct from
 * `listAuditLogs`'s cross-entity Dziennik zdarzeń view. Same underlying
 * table, scoped to one `(entity, entityId)` pair.
 */
export async function listAuditLogsForEntity(entity: string, entityId: string): Promise<readonly AdminAuditLogListItem[]> {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: 'desc' },
    take: RECORD_ACTIVITY_LIMIT,
    select: { id: true, actorEmail: true, entity: true, entityId: true, action: true, diff: true, createdAt: true },
  });
}

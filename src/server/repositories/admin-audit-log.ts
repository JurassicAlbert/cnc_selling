/**
 * Read-only view over `AuditLog` — every mutation across every P7b slice
 * has been writing here since `writeAuditLog()` was introduced (P7a). No
 * new schema, no new writes: this is purely "the audit log viewer" half
 * of `docs/ARCHITECTURE.md` §16A.1 module 11, the checklist's own last
 * open item.
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';

export type AdminAuditLogListFilters = {
  readonly entity?: string;
  readonly action?: string;
  /** Matches `actorEmail` (contains) or `entityId` (exact) — one search box covers both, since either is how staff will actually look something up. */
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

const ADMIN_AUDIT_LOG_LIMIT = 200;

export async function listAuditLogs(filters: AdminAuditLogListFilters): Promise<readonly AdminAuditLogListItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: filters.entity,
      action: filters.action,
      ...(filters.search !== undefined && filters.search.length > 0
        ? { OR: [{ actorEmail: { contains: filters.search, mode: 'insensitive' } }, { entityId: filters.search }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_AUDIT_LOG_LIMIT,
    select: { id: true, actorEmail: true, entity: true, entityId: true, action: true, diff: true, createdAt: true },
  });
  return logs;
}

/** Populates the entity filter dropdown from what's actually been written — self-updating as new slices add new entities, never a hardcoded list that drifts. */
export async function listAuditLogEntities(): Promise<readonly string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } });
  return rows.map((r) => r.entity);
}

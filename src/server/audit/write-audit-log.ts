/**
 * `AuditLog` (`prisma/schema.prisma`) has existed since before P7 but was
 * never written to — no admin mutation existed yet. `docs/ARCHITECTURE.md`
 * §16A.2 invariant 4: "Every mutation is audited." `actorEmail` is
 * denormalised on the model itself (survives staff account deletion), so
 * it's captured here rather than joined later from `actorId`.
 */

import { prisma } from '@/server/db/client';
import type { CurrentSession } from '@/server/auth/session';
import { Prisma } from '@/generated/prisma/client';

export type AuditAction = 'create' | 'update' | 'delete' | 'transition' | 'export';

export type WriteAuditLogInput = {
  readonly actor: CurrentSession;
  readonly entity: string;
  readonly entityId: string | null;
  readonly action: AuditAction;
  readonly diff?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor.userId,
      actorEmail: input.actor.email,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      diff: input.diff ?? Prisma.JsonNull,
    },
  });
}

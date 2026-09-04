/**
 * Staff design-review decisions. Deliberately does NOT touch `Order.status`
 * - `checkOrderStatusTransition`'s own DESIGN_REVIEW gate (`domain/order-
 * status/transitions.ts`) already blocks `DESIGN_REVIEW -> CONFIRMED` while
 * any linked `CustomerDesign` isn't `APPROVED`; staff transitions the order
 * separately, via `admin-orders.ts`'s `transitionOrderStatus`, once every
 * design on it is resolved.
 *
 * Split into `applyDesignReviewDecision` (explicit staff actor, testable)
 * and `decideDesignReview` (the real Server Action, derives the actor via
 * `requireStaffSession()`) - same reason as `admin-orders.ts`.
 */

import { revalidatePath } from 'next/cache';

import type { DesignReviewStatus, ProductionMethod } from '@/generated/prisma/enums';
import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type DesignReviewDecision = Extract<DesignReviewStatus, 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED'>;

export type DecideDesignReviewResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyDesignReviewDecision(
  staff: CurrentSession,
  designId: string,
  decision: DesignReviewDecision,
  productionMethod: ProductionMethod | null,
  commentPl: string | null,
): Promise<DecideDesignReviewResult> {
  const design = await prisma.customerDesign.findUnique({ where: { id: designId }, select: { id: true, status: true } });
  if (design === null) {
    return { ok: false, detail: 'Projekt nie istnieje.' };
  }
  if (decision === 'APPROVED' && productionMethod === null) {
    return { ok: false, detail: 'Zatwierdzenie wymaga wyboru metody produkcji.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerDesign.update({
      where: { id: designId },
      data: { status: decision, productionMethod: decision === 'APPROVED' ? productionMethod : undefined },
    });
    if (commentPl !== null && commentPl.trim().length > 0) {
      await tx.designReviewComment.create({
        data: { designId, authorType: 'staff', authorId: staff.userId, bodyPl: commentPl },
      });
    }
  });
  await writeAuditLog({
    actor: staff,
    entity: 'CustomerDesign',
    entityId: designId,
    action: 'update',
    diff: { status: { from: design.status, to: decision }, productionMethod },
  });

  return { ok: true };
}

export async function decideDesignReview(
  designId: string,
  decision: DesignReviewDecision,
  productionMethod: ProductionMethod | null,
  commentPl: string | null,
): Promise<DecideDesignReviewResult> {
  const staff = await requireStaffSession();
  const result = await applyDesignReviewDecision(staff, designId, decision, productionMethod, commentPl);
  if (result.ok) {
    revalidatePath(`/panel/weryfikacja/${designId}`);
    revalidatePath('/panel/weryfikacja');
  }
  return result;
}

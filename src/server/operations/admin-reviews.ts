/**
 * Staff review moderation. Deliberately, only a status change exists here
 * - no function in this file (or anywhere else in this codebase) can edit
 * a review's `bodyPl`/`authorNamePl`/`rating`. §16A.1 module 9: "no
 * facility to author a testimonial in a customer's name," enforced by the
 * shape of the code, not just policy.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { ReviewStatus } from '@/generated/prisma/enums';

export async function applySetReviewStatus(
  staff: CurrentSession,
  id: string,
  status: Extract<ReviewStatus, 'APPROVED' | 'REJECTED'>,
): Promise<void> {
  const current = await prisma.review.findUnique({ where: { id }, select: { status: true } });
  if (current === null) {
    return;
  }
  await prisma.review.update({
    where: { id },
    data: { status, moderatedAt: new Date(), moderatedByEmail: staff.email },
  });
  await writeAuditLog({
    actor: staff,
    entity: 'Review',
    entityId: id,
    action: 'update',
    diff: { status: { from: current.status, to: status } },
  });
}

export async function setReviewStatus(id: string, status: Extract<ReviewStatus, 'APPROVED' | 'REJECTED'>): Promise<void> {
  const staff = await requireStaffSession();
  await applySetReviewStatus(staff, id, status);
  revalidatePath('/panel/opinie');
  revalidatePath('/');
}

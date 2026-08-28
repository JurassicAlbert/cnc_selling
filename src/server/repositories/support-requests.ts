/**
 * P9 continuation, 2026-08-28 — the customer-facing half of support
 * requests. `SubmitSupportRequestResult`/`applySubmitSupportRequest`
 * (`server/actions/support-requests.ts`) already let a logged-in customer
 * *file* a request; there was no way for them to see it again afterward —
 * only the admin side (`admin-support-requests.ts`) could list them.
 * `adminNotesPl` is deliberately never selected here — the schema's own
 * comment says it's "Staff-only — never shown to the customer".
 */

import { prisma } from '@/server/db/client';
import type { SupportRequestStatus } from '@/generated/prisma/enums';
import { getSession } from '@/server/auth/session';

export type MySupportRequestListItem = {
  readonly id: string;
  readonly subjectPl: string;
  readonly status: SupportRequestStatus;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly createdAt: Date;
};

export async function listSupportRequestsForUser(userId: string): Promise<readonly MySupportRequestListItem[]> {
  const requests = await prisma.supportRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      subjectPl: true,
      status: true,
      orderId: true,
      order: { select: { orderNumber: true } },
      createdAt: true,
    },
  });
  return requests.map((r) => ({
    id: r.id,
    subjectPl: r.subjectPl,
    status: r.status,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? null,
    createdAt: r.createdAt,
  }));
}

export async function listMySupportRequests(): Promise<readonly MySupportRequestListItem[]> {
  const session = await getSession();
  if (session === null) {
    return [];
  }
  return listSupportRequestsForUser(session.userId);
}

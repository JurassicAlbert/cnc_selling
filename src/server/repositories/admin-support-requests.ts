/** Admin `SupportRequest` queries — every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { SupportRequestStatus } from '@/generated/prisma/enums';

export type AdminSupportRequestListFilters = { readonly status?: SupportRequestStatus };

export type AdminSupportRequestListItem = {
  readonly id: string;
  readonly subjectPl: string;
  readonly email: string;
  readonly status: SupportRequestStatus;
  readonly orderNumber: string | null;
  readonly createdAt: Date;
};

export async function listSupportRequestsForAdmin(filters: AdminSupportRequestListFilters = {}): Promise<readonly AdminSupportRequestListItem[]> {
  const requests = await prisma.supportRequest.findMany({
    where: filters.status !== undefined ? { status: filters.status } : undefined,
    orderBy: { createdAt: 'desc' },
    select: { id: true, subjectPl: true, email: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
  });
  return requests.map((r) => ({
    id: r.id,
    subjectPl: r.subjectPl,
    email: r.email,
    status: r.status,
    orderNumber: r.order?.orderNumber ?? null,
    createdAt: r.createdAt,
  }));
}

export type AdminSupportRequestDetail = {
  readonly id: string;
  readonly email: string;
  readonly namePl: string | null;
  readonly subjectPl: string;
  readonly messagePl: string;
  readonly status: SupportRequestStatus;
  readonly adminNotesPl: string | null;
  readonly createdAt: Date;
  readonly orderNumber: string | null;
  readonly shipmentId: string | null;
};

export async function findSupportRequestForAdmin(id: string): Promise<AdminSupportRequestDetail | null> {
  const request = await prisma.supportRequest.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      namePl: true,
      subjectPl: true,
      messagePl: true,
      status: true,
      adminNotesPl: true,
      createdAt: true,
      shipmentId: true,
      order: { select: { orderNumber: true } },
    },
  });
  if (request === null) {
    return null;
  }
  return {
    id: request.id,
    email: request.email,
    namePl: request.namePl,
    subjectPl: request.subjectPl,
    messagePl: request.messagePl,
    status: request.status,
    adminNotesPl: request.adminNotesPl,
    createdAt: request.createdAt,
    orderNumber: request.order?.orderNumber ?? null,
    shipmentId: request.shipmentId,
  };
}

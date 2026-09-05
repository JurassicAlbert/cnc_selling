/** Admin `SupportRequest` queries - every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { PageRequest } from '@/domain/pagination/page';
import type { Page } from '@/server/repositories/page';
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

/**
 * PERF-03. This returned the whole table in one payload. It is a record
 * customers create rather than a catalogue staff curate, so nobody decides
 * how many rows there are - which is the distinction the item draws with
 * "reuse ADMIN-01's pagination helper **as they grow**; do not pre-optimise
 * all 22".
 *
 * One shared `where` for both halves, as in `listOrdersForAdmin`: a count
 * built from a separately-written filter is how a list ends up offering
 * pages of a result that has none of them.
 */
export async function listSupportRequestsForAdmin(
  filters: AdminSupportRequestListFilters = {},
  page: Pick<PageRequest, 'skip' | 'take'>,
): Promise<Page<AdminSupportRequestListItem>> {
  const where = filters.status !== undefined ? { status: filters.status } : {};

  const [requests, total] = await Promise.all([
    prisma.supportRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
      select: { id: true, subjectPl: true, email: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
    }),
    prisma.supportRequest.count({ where }),
  ]);

  return {
    items: requests.map((r) => ({
      id: r.id,
      subjectPl: r.subjectPl,
      email: r.email,
      status: r.status,
      orderNumber: r.order?.orderNumber ?? null,
      createdAt: r.createdAt,
    })),
    total,
  };
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

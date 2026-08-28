/** Admin `Shipment` reads — every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { ShipmentStatus } from '@/generated/prisma/enums';

export type AdminShipmentDetail = {
  readonly id: string;
  readonly orderId: string;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatus;
  readonly shippedAt: Date | null;
  readonly estimatedDeliveryAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly issueDescriptionPl: string | null;
  readonly issueResolutionPl: string | null;
  readonly internalNotesPl: string | null;
  readonly customerNotesPl: string | null;
};

export async function findShipmentForOrder(orderId: string): Promise<AdminShipmentDetail | null> {
  return prisma.shipment.findUnique({
    where: { orderId },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      trackingNumber: true,
      status: true,
      shippedAt: true,
      estimatedDeliveryAt: true,
      deliveredAt: true,
      issueDescriptionPl: true,
      issueResolutionPl: true,
      internalNotesPl: true,
      customerNotesPl: true,
    },
  });
}

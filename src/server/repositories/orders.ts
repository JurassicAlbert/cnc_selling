/**
 * Guest order lookup — `docs/ARCHITECTURE.md` §15.4/§16.1: constant-time
 * `accessToken` comparison, and a wrong token is indistinguishable from a
 * nonexistent order (`null` either way) — the same "404, not 403"
 * discipline already used for file access, so an order's existence is
 * never probeable by trying tokens.
 */

import { timingSafeEqual } from 'node:crypto';

import { prisma } from '@/server/db/client';
import type { OrderStatus, PaymentMethod, ShipmentStatus } from '@/generated/prisma/enums';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';

export type OrderConfirmationItemView = {
  readonly quantity: number;
  readonly lineGrossGrosze: number;
  readonly snapshot: OrderItemSnapshot;
};

/** P9 phase 7: the customer-facing slice of `Shipment` — no `internalNotesPl`/`issueResolutionPl`, staff-only fields. */
export type OrderShipmentView = {
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatus;
  readonly shippedAt: Date | null;
  readonly estimatedDeliveryAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly issueDescriptionPl: string | null;
  readonly customerNotesPl: string | null;
};

export type OrderConfirmationView = {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentMethod: PaymentMethod;
  readonly totalGrossGrosze: number;
  readonly email: string;
  readonly items: readonly OrderConfirmationItemView[];
  readonly shipment: OrderShipmentView | null;
};

const SHIPMENT_CUSTOMER_SELECT = {
  carrier: true,
  trackingNumber: true,
  status: true,
  shippedAt: true,
  estimatedDeliveryAt: true,
  deliveredAt: true,
  issueDescriptionPl: true,
  customerNotesPl: true,
} as const;

export type OrderSummaryView = {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly totalGrossGrosze: number;
  readonly createdAt: Date;
  readonly itemCount: number;
  /** `null` until staff creates a `Shipment` row — most orders start their life this way. P9 continuation: surfaced on `/moje-konto` so "state after order but before shipping" is visible without opening each order individually. */
  readonly shipmentStatus: ShipmentStatus | null;
};

/** Order history (P6 Part C) — `Order.userId` is already indexed. */
export async function listOrdersForUser(userId: string): Promise<readonly OrderSummaryView[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      status: true,
      totalGrossGrosze: true,
      createdAt: true,
      items: { select: { quantity: true } },
      shipment: { select: { status: true } },
    },
  });
  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    totalGrossGrosze: order.totalGrossGrosze,
    createdAt: order.createdAt,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    shipmentStatus: order.shipment?.status ?? null,
  }));
}

/**
 * The order-history detail view — ownership checked by `userId`, not by
 * `accessToken` (unlike `findOrderForConfirmation`'s guest lookup): a logged
 * in customer viewing their own history has already proven who they are via
 * their session, so no token is needed or shown here.
 */
export async function findOrderForUser(orderNumber: string, userId: string): Promise<OrderConfirmationView | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      userId: true,
      status: true,
      paymentMethod: true,
      totalGrossGrosze: true,
      email: true,
      items: {
        select: { quantity: true, lineGrossGrosze: true, snapshot: true },
      },
      shipment: { select: SHIPMENT_CUSTOMER_SELECT },
    },
  });
  if (order === null || order.userId !== userId) {
    return null;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalGrossGrosze: order.totalGrossGrosze,
    email: order.email,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      lineGrossGrosze: item.lineGrossGrosze,
      snapshot: item.snapshot as unknown as OrderItemSnapshot,
    })),
    shipment: order.shipment,
  };
}

export async function findOrderForConfirmation(
  orderNumber: string,
  token: string,
): Promise<OrderConfirmationView | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      accessToken: true,
      status: true,
      paymentMethod: true,
      totalGrossGrosze: true,
      email: true,
      items: {
        select: { quantity: true, lineGrossGrosze: true, snapshot: true },
      },
      shipment: { select: SHIPMENT_CUSTOMER_SELECT },
    },
  });
  if (order === null) {
    return null;
  }

  const provided = Buffer.from(token);
  const expected = Buffer.from(order.accessToken);
  // `timingSafeEqual` throws on a length mismatch rather than returning
  // `false` — guarded explicitly so a wrong-length token 404s instead of
  // 500ing.
  const matches = provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!matches) {
    return null;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalGrossGrosze: order.totalGrossGrosze,
    email: order.email,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      lineGrossGrosze: item.lineGrossGrosze,
      snapshot: item.snapshot as unknown as OrderItemSnapshot,
    })),
    shipment: order.shipment,
  };
}

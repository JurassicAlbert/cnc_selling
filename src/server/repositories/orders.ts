/**
 * Guest order lookup — `docs/ARCHITECTURE.md` §15.4/§16.1: constant-time
 * `accessToken` comparison, and a wrong token is indistinguishable from a
 * nonexistent order (`null` either way) — the same "404, not 403"
 * discipline already used for file access, so an order's existence is
 * never probeable by trying tokens.
 */

import { timingSafeEqual } from 'node:crypto';

import { prisma } from '@/server/db/client';
import type { OrderStatus, PaymentMethod } from '@/generated/prisma/enums';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';

export type OrderConfirmationItemView = {
  readonly quantity: number;
  readonly lineGrossGrosze: number;
  readonly snapshot: OrderItemSnapshot;
};

export type OrderConfirmationView = {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentMethod: PaymentMethod;
  readonly totalGrossGrosze: number;
  readonly email: string;
  readonly items: readonly OrderConfirmationItemView[];
};

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
  };
}

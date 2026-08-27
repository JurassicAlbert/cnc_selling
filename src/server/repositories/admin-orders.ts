/**
 * Admin order queries — unscoped by owner, unlike `repositories/orders.ts`'s
 * customer-facing `listOrdersForUser`/`findOrderForUser`. Every caller here
 * MUST go through `requireStaffSession()` first; these functions don't check
 * who's asking.
 */

import { prisma } from '@/server/db/client';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/generated/prisma/enums';
import type { OrderConfirmationItemView } from '@/server/repositories/orders';

export type AdminOrderListFilters = {
  readonly status?: OrderStatus;
  readonly paymentStatus?: PaymentStatus;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  /** Matches `orderNumber` (prefix) or `email` (exact), case-insensitive. */
  readonly search?: string;
};

export type AdminOrderListItem = {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly totalGrossGrosze: number;
  readonly createdAt: Date;
  readonly email: string;
  readonly customerName: string;
};

const ADMIN_ORDER_LIST_LIMIT = 100;

export async function listOrdersForAdmin(filters: AdminOrderListFilters): Promise<readonly AdminOrderListItem[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      createdAt:
        filters.dateFrom !== undefined || filters.dateTo !== undefined
          ? { gte: filters.dateFrom, lte: filters.dateTo }
          : undefined,
      ...(filters.search !== undefined && filters.search.length > 0
        ? {
            OR: [
              { orderNumber: { startsWith: filters.search, mode: 'insensitive' } },
              { email: { equals: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_ORDER_LIST_LIMIT,
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalGrossGrosze: true,
      createdAt: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalGrossGrosze: order.totalGrossGrosze,
    createdAt: order.createdAt,
    email: order.email,
    customerName: `${order.firstName} ${order.lastName}`,
  }));
}

export type AdminOrderEventView = {
  readonly fromStatus: OrderStatus | null;
  readonly toStatus: OrderStatus;
  readonly actorType: string;
  readonly actorEmail: string | null;
  readonly notePl: string | null;
  readonly createdAt: Date;
};

export type AdminOrderView = {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentMethod: PaymentMethod;
  readonly paymentStatus: PaymentStatus;
  readonly totalGrossGrosze: number;
  readonly subtotalNetGrosze: number;
  readonly vatGrosze: number;
  readonly shippingGrosze: number;
  readonly email: string;
  readonly phone: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string | null;
  readonly nip: string | null;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly productionNotes: string | null;
  readonly items: readonly OrderConfirmationItemView[];
  readonly events: readonly AdminOrderEventView[];
  /** True while any linked `CustomerDesign` isn't `APPROVED` — mirrors the check `createOrder`/`checkOrderStatusTransition` use for the DESIGN_REVIEW gate. */
  readonly hasUnapprovedCustomDesign: boolean;
};

export async function findOrderForAdmin(orderNumber: string): Promise<AdminOrderView | null> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalGrossGrosze: true,
      subtotalNetGrosze: true,
      vatGrosze: true,
      shippingGrosze: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      companyName: true,
      nip: true,
      street: true,
      postalCode: true,
      city: true,
      productionNotes: true,
      items: {
        select: {
          quantity: true,
          lineGrossGrosze: true,
          snapshot: true,
          customerDesign: { select: { status: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        select: { fromStatus: true, toStatus: true, actorType: true, actorEmail: true, notePl: true, createdAt: true },
      },
    },
  });
  if (order === null) {
    return null;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalGrossGrosze: order.totalGrossGrosze,
    subtotalNetGrosze: order.subtotalNetGrosze,
    vatGrosze: order.vatGrosze,
    shippingGrosze: order.shippingGrosze,
    email: order.email,
    phone: order.phone,
    firstName: order.firstName,
    lastName: order.lastName,
    companyName: order.companyName,
    nip: order.nip,
    street: order.street,
    postalCode: order.postalCode,
    city: order.city,
    productionNotes: order.productionNotes,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      lineGrossGrosze: item.lineGrossGrosze,
      snapshot: item.snapshot as unknown as OrderConfirmationItemView['snapshot'],
    })),
    events: order.events,
    hasUnapprovedCustomDesign: order.items.some(
      (item) => item.customerDesign !== null && item.customerDesign.status !== 'APPROVED',
    ),
  };
}

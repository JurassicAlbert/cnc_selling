/**
 * Dashboard aggregation queries - `docs/ARCHITECTURE.md` §16A module 1,
 * minus the configurator funnel (needs a new `AnalyticsEvent` model and
 * instrumenting every configurator step; a separate slice, not a
 * dashboard-rendering task - tracked as a follow-up, not silently dropped).
 *
 * Every caller here MUST go through `requireStaffSession()` first, same
 * rule as `admin-orders.ts` - these functions don't check who's asking.
 *
 * "Revenue" throughout means orders NOT `CANCELLED`, regardless of payment
 * status - booked revenue, not collected revenue. That's a deliberate
 * definition (an e-commerce dashboard could reasonably mean either), named
 * explicitly here so nobody has to re-derive it from the query.
 */

import { prisma } from '@/server/db/client';
import type { OrderStatus } from '@/generated/prisma/enums';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';
import { summariseTopEntities } from '@/domain/analytics/top-entities';
import type {
  TopEntity as TopEntityValue,
  TopEntityKind as TopEntityKindValue,
} from '@/domain/analytics/top-entities';
import { PRODUCTION_STATUSES } from '@/server/repositories/admin-production';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type DashboardKpis = {
  readonly ordersToday: number;
  readonly orders7d: number;
  readonly orders30d: number;
  readonly revenueNet30dGrosze: number;
  readonly revenueGross30dGrosze: number;
  readonly averageOrderValueGrosze: number;
  readonly ordersAwaitingPayment: number;
  readonly designsAwaitingReview: number;
  readonly ordersInProduction: number;
};

export async function getDashboardKpis(now: Date = new Date()): Promise<DashboardKpis> {
  const todayStart = startOfDay(now);
  const from7d = new Date(now.getTime() - 7 * DAY_MS);
  const from30d = new Date(now.getTime() - 30 * DAY_MS);

  // "ordersNd" counts every order placed in the window regardless of
  // status (an activity metric - a cancelled order is still an order that
  // came in) while the revenue rows below are deliberately non-CANCELLED
  // only. AOV is therefore computed against the revenue rows' own count,
  // NOT `orders30d` - averaging non-cancelled revenue over an order count
  // that includes cancelled orders would understate it.
  const [ordersToday, orders7d, orders30d, revenueRows30d, ordersAwaitingPayment, designsAwaitingReview, ordersInProduction] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: from7d } } }),
      prisma.order.count({ where: { createdAt: { gte: from30d } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: from30d }, status: { not: 'CANCELLED' } },
        select: { subtotalNetGrosze: true, totalGrossGrosze: true },
      }),
      prisma.order.count({ where: { paymentStatus: 'AWAITING' } }),
      prisma.customerDesign.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.order.count({ where: { status: { in: [...PRODUCTION_STATUSES] } } }),
    ]);

  const revenueNet30dGrosze = revenueRows30d.reduce((sum, o) => sum + o.subtotalNetGrosze, 0);
  const revenueGross30dGrosze = revenueRows30d.reduce((sum, o) => sum + o.totalGrossGrosze, 0);

  return {
    ordersToday,
    orders7d,
    orders30d,
    revenueNet30dGrosze,
    revenueGross30dGrosze,
    averageOrderValueGrosze: revenueRows30d.length === 0 ? 0 : Math.round(revenueGross30dGrosze / revenueRows30d.length),
    ordersAwaitingPayment,
    designsAwaitingReview,
    ordersInProduction,
  };
}

export type DateRange = { readonly from: Date; readonly to: Date };

export type RevenuePoint = { readonly date: string; readonly netGrosze: number; readonly grossGrosze: number };

export async function getRevenueOverTime(range: DateRange): Promise<readonly RevenuePoint[]> {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.from, lte: range.to }, status: { not: 'CANCELLED' } },
    select: { createdAt: true, subtotalNetGrosze: true, totalGrossGrosze: true },
    orderBy: { createdAt: 'asc' },
  });

  const byDay = new Map<string, { netGrosze: number; grossGrosze: number }>();
  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key) ?? { netGrosze: 0, grossGrosze: 0 };
    bucket.netGrosze += order.subtotalNetGrosze;
    bucket.grossGrosze += order.totalGrossGrosze;
    byDay.set(key, bucket);
  }

  // Fill every day in the range, not just days with orders, so the chart's
  // x-axis is a real continuous timeline rather than skipping quiet days.
  // Deliberately UTC throughout this loop (`setUTCDate`, not `setDate`) -
  // the bucket keys above come from `createdAt.toISOString()`, which is
  // always UTC; walking the range in local time (this server runs in
  // Europe/Warsaw, UTC+1/+2) would misalign the fill loop's day boundaries
  // against those keys by an hour, producing a spurious extra/missing day.
  const points: RevenuePoint[] = [];
  const cursor = new Date(`${range.from.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const endKey = range.to.toISOString().slice(0, 10);
  while (cursor.toISOString().slice(0, 10) <= endKey) {
    const key = cursor.toISOString().slice(0, 10);
    const bucket = byDay.get(key) ?? { netGrosze: 0, grossGrosze: 0 };
    points.push({ date: key, netGrosze: bucket.netGrosze, grossGrosze: bucket.grossGrosze });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

export async function getOrdersByStatus(range: DateRange): Promise<ReadonlyMap<OrderStatus, number>> {
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.status, g._count._all]));
}

/*
  Types and arithmetic both live in `@/domain/analytics/top-entities` now.
  Re-exported here so the dashboard keeps importing its data from one place.
*/
export type { TopEntity, TopEntityKind } from '@/domain/analytics/top-entities';

/**
 * Best sellers for several kinds, from **one** read of the order lines.
 *
 * Replaces a per-kind `getTopEntities`, which the dashboard called three
 * times. Each call read every `OrderItem` in the range and aggregated in
 * JavaScript, so the three differed only in which key of the snapshot they
 * looked at: measured at **107 ms of the dashboard's 116 ms** on 2026-09-16.
 *
 * The rows cannot be grouped in SQL, because the names live inside
 * `OrderItem.snapshot` - the immutable JSON an order keeps so that rendering
 * it never joins a live catalogue row. What was avoidable was reading them
 * three times, not reading them at all.
 */
export async function getTopEntitiesForKinds(
  range: DateRange,
  kinds: readonly TopEntityKindValue[],
  limit = 5,
): Promise<Record<TopEntityKindValue, readonly TopEntityValue[]>> {
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { not: 'CANCELLED' } } },
    select: { quantity: true, lineGrossGrosze: true, snapshot: true },
  });

  return summariseTopEntities(
    items.map((item) => ({
      quantity: item.quantity,
      lineGrossGrosze: item.lineGrossGrosze,
      snapshot: item.snapshot as unknown as OrderItemSnapshot,
    })),
    kinds,
    limit,
  );
}

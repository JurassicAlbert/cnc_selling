/**
 * Production queue - read-only (no mutations live here; status changes stay
 * on `/panel/zamowienia/[orderNumber]`, already built in P7a). "Queued
 * work" is exactly the stages after payment/design-review and before
 * shipped/completed - nothing earlier can be produced yet, nothing later
 * still needs the machine.
 */

import { prisma } from '@/server/db/client';
import type { OrderStatus } from '@/generated/prisma/enums';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';

export const PRODUCTION_STATUSES: readonly OrderStatus[] = ['CONFIRMED', 'IN_PRODUCTION', 'FINISHING', 'READY_TO_SHIP'];

/**
 * How many modules an item is cut into, or zero when its snapshot does not
 * say.
 *
 * Same reasoning as `itemMachineMinutes` below, and the same shape of guard:
 * `OrderItem.snapshot` is `Json` and deliberately immutable - it is what the
 * customer actually bought, frozen at checkout - so an order placed before a
 * field existed genuinely does not carry it.
 *
 * Added 2026-09-05. This one read `snapshot.moduleLayout.totalModules`
 * unguarded, so a single item without the field threw while the queue was
 * being built, and the whole production page failed for every order and
 * every member of staff. A missing count is worth showing as zero; it is not
 * worth an outage.
 */
function itemModules(snapshot: OrderItemSnapshot, quantity: number): number {
  const total = snapshot.moduleLayout?.totalModules;
  return typeof total === 'number' ? total * quantity : 0;
}

function itemAreaM2(snapshot: OrderItemSnapshot, quantity: number): number {
  if (typeof snapshot.widthMm !== 'number' || typeof snapshot.heightMm !== 'number') {
    return 0;
  }
  return (snapshot.widthMm * snapshot.heightMm * quantity) / 1_000_000;
}

function itemMachineMinutes(snapshot: OrderItemSnapshot, quantity: number): number {
  // `typeof !== 'number'`, not `=== null`: orders placed before this field
  // existed have it genuinely absent from the stored JSON (`undefined`),
  // not explicitly `null` - both mean "unknown rate," same as a real
  // `CUSTOM`-product `null`.
  if (typeof snapshot.machiningMilliMinutesPerM2 !== 'number') {
    return 0;
  }
  return itemAreaM2(snapshot, quantity) * (snapshot.machiningMilliMinutesPerM2 / 1000);
}

export type ProductionQueueItem = {
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly customerName: string;
  readonly moduleCount: number;
  readonly areaM2: number;
};

export async function listProductionQueue(): Promise<readonly ProductionQueueItem[]> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...PRODUCTION_STATUSES] } },
    orderBy: { createdAt: 'asc' },
    select: {
      orderNumber: true,
      status: true,
      firstName: true,
      lastName: true,
      items: { select: { quantity: true, snapshot: true } },
    },
  });

  return orders.map((order) => {
    let moduleCount = 0;
    let areaM2 = 0;
    for (const item of order.items) {
      const snapshot = item.snapshot as unknown as OrderItemSnapshot;
      moduleCount += itemModules(snapshot, item.quantity);
      areaM2 += itemAreaM2(snapshot, item.quantity);
    }
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: `${order.firstName} ${order.lastName}`,
      moduleCount,
      areaM2,
    };
  });
}

export type ProductionCapacity = {
  readonly queuedAreaM2: number;
  readonly queuedMachineMinutes: number;
  readonly weeklyCapacityMinutes: number;
};

export async function getProductionCapacity(): Promise<ProductionCapacity> {
  const [orders, machineSettings] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...PRODUCTION_STATUSES] } },
      select: { items: { select: { quantity: true, snapshot: true } } },
    }),
    prisma.machineSettings.findUnique({ where: { id: 1 }, select: { weeklyCapacityMinutes: true } }),
  ]);

  let queuedAreaM2 = 0;
  let queuedMachineMinutes = 0;
  for (const order of orders) {
    for (const item of order.items) {
      const snapshot = item.snapshot as unknown as OrderItemSnapshot;
      queuedAreaM2 += itemAreaM2(snapshot, item.quantity);
      queuedMachineMinutes += itemMachineMinutes(snapshot, item.quantity);
    }
  }

  return {
    queuedAreaM2,
    queuedMachineMinutes,
    weeklyCapacityMinutes: machineSettings?.weeklyCapacityMinutes ?? 0,
  };
}

export type OrderModuleManifestItem = {
  readonly productNamePl: string;
  readonly modules: OrderItemSnapshot['moduleLayout']['modules'];
};

/** For the module-manifest section on `/panel/zamowienia/[orderNumber]` - one row per `OrderItem`, only the modules (not the full snapshot `findOrderForAdmin` already returns). */
export async function listOrderModuleManifest(orderNumber: string): Promise<readonly OrderModuleManifestItem[]> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { items: { select: { snapshot: true } } },
  });
  if (order === null) {
    return [];
  }
  return order.items.map((item) => {
    const snapshot = item.snapshot as unknown as OrderItemSnapshot;
    // Same guard as `itemModules` above, for the same reason: a snapshot
    // written before `moduleLayout` existed has no modules to list, and an
    // order detail page that throws is worse than one showing none.
    return { productNamePl: snapshot.productNamePl, modules: snapshot.moduleLayout?.modules ?? [] };
  });
}

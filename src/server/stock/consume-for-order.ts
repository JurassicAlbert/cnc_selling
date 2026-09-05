/**
 * Take an order's material off the shelf when it enters production.
 *
 * `docs/AI-CHECKLIST.md` WAREHOUSE-01, the half deliberately not built on
 * 2026-09-04: `MaterialStock` recorded what arrived and what it cost, and
 * nothing ever decremented it. Two owner decisions on 2026-09-05 unblocked
 * it - oldest batch first, and consumption measured by area rather than by
 * whole boards. Both live in `domain/stock/consumption.ts`, pure and tested;
 * this module only finds the rows and writes the result.
 *
 * **Called inside the status transition's own transaction**, so an order
 * cannot be in production with no record of what it took, or the reverse.
 * That is the same atomicity P1-6 established for the transition itself.
 *
 * **Never blocks the transition.** Recorded stock that cannot cover an order
 * is reported, not thrown: production happens whether or not a delivery has
 * been entered, and refusing to move a real order because of a missing
 * warehouse row would be the tail wagging the dog. Nothing here invents
 * material to make the numbers tidy - a shortfall is returned as a shortfall
 * and shown to the operator.
 */

import { planConsumption } from '@/domain/stock/consumption';
import type { ConsumableBatch } from '@/domain/stock/consumption';
import type { Prisma } from '@/generated/prisma/client';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';

export type StockShortfall = {
  readonly materialNamePl: string;
  readonly areaMm2: number;
};

export type OrderConsumption = {
  readonly drawnAreaMm2: number;
  readonly costGrosze: number;
  /** Materials whose recorded batches could not cover the order. */
  readonly shortfalls: readonly StockShortfall[];
  /** Lines skipped because nothing about them says how much material they take. */
  readonly unmeasurableLines: number;
};

/**
 * The footprint one order line takes off a board.
 *
 * `widthMm * heightMm * quantity`, from the snapshot - the record of what was
 * actually sold, so a later catalogue edit cannot change what an order is
 * held to have consumed.
 *
 * Module count is deliberately not a multiplier. A piece too large for the
 * machine is cut as several modules that together make the same finished
 * area; counting them separately would charge the order for material it never
 * used. The joinery overlap between modules is real and is not modelled, for
 * the same reason the area rule accepts offcut error: it is a few percent,
 * and the alternative is asking the operator to measure.
 */
function neededAreaMm2(snapshot: OrderItemSnapshot, quantity: number): number | null {
  if (snapshot.widthMm === null || snapshot.heightMm === null) {
    return null;
  }
  return snapshot.widthMm * snapshot.heightMm * quantity;
}

export async function consumeStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<OrderConsumption> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: {
      id: true,
      quantity: true,
      snapshot: true,
      materialId: true,
      material: { select: { namePl: true } },
    },
  });

  let drawnAreaMm2 = 0;
  let costGrosze = 0;
  let unmeasurableLines = 0;
  const shortfallByMaterial = new Map<string, StockShortfall>();

  for (const item of items) {
    // Orders placed before 2026-09-05 carry no link, and a CUSTOM_UPLOAD line
    // need not name a catalogue material at all. Neither is an error; there is
    // simply no shelf to draw from.
    if (item.materialId === null || item.material === null) {
      continue;
    }

    const needed = neededAreaMm2(item.snapshot as unknown as OrderItemSnapshot, item.quantity);
    if (needed === null) {
      unmeasurableLines += 1;
      continue;
    }
    if (needed === 0) {
      continue;
    }

    /*
      Read per line rather than once for the whole order, on purpose. Two
      lines can share a material, and the second must see what the first has
      already taken - planning both against one snapshot of the shelf would
      hand out the same board twice. Orders have a handful of lines, so this
      is a handful of indexed reads inside a transaction that is already open.
    */
    const batches = await tx.materialStock.findMany({
      where: { materialId: item.materialId },
      orderBy: { purchasedAt: 'asc' },
      select: {
        id: true,
        quantity: true,
        widthMm: true,
        heightMm: true,
        consumedAreaMm2: true,
        purchasePriceGrosze: true,
        purchasedAt: true,
      },
    });

    const plan = planConsumption(batches satisfies readonly ConsumableBatch[], needed);

    for (const draw of plan.draws) {
      await tx.materialStock.update({
        where: { id: draw.batchId },
        data: { consumedAreaMm2: { increment: draw.areaMm2 } },
      });
      await tx.stockConsumption.create({
        data: {
          orderId,
          orderItemId: item.id,
          materialStockId: draw.batchId,
          areaMm2: draw.areaMm2,
          costGrosze: draw.costGrosze,
        },
      });
      drawnAreaMm2 += draw.areaMm2;
      costGrosze += draw.costGrosze;
    }

    if (plan.shortfallAreaMm2 > 0) {
      const namePl = item.material.namePl;
      const existing = shortfallByMaterial.get(namePl);
      shortfallByMaterial.set(namePl, {
        materialNamePl: namePl,
        areaMm2: (existing?.areaMm2 ?? 0) + plan.shortfallAreaMm2,
      });
    }
  }

  return {
    drawnAreaMm2,
    costGrosze,
    shortfalls: [...shortfallByMaterial.values()],
    unmeasurableLines,
  };
}

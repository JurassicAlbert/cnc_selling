/**
 * `docs/AI-CHECKLIST.md` WAREHOUSE-01 - the shelf is drawn down when an order
 * actually goes on the machine.
 *
 * `tests/unit/stock-consumption.test.ts` pins the arithmetic and the two owner
 * decisions behind it (oldest batch first, measured by area). This drives the
 * whole thing through the real `applyOrderStatusTransition` against real
 * Postgres, because the parts that can go wrong here are not arithmetic:
 * whether the write happens in the same transaction as the status change,
 * whether a second line sees what the first one took, and whether an order
 * with no recorded stock still reaches production.
 *
 * Real writes and explicit cleanup, not a rollback: the operations use the
 * app's own `prisma` singleton, so a row written inside an uncommitted
 * interactive transaction would be invisible to them - the constraint
 * `tests/integration/authz.test.ts` recorded first.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { applyOrderStatusTransition } from '@/server/operations/admin-orders';

const PREFIX = 'test-warehouse01-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

/** A real board from `warehouse.spec.ts`: 2000 x 1250 x 18, 320 zl net. */
const BOARD = { widthMm: 2_000, heightMm: 1_250, thicknessMm: 18, purchasePriceGrosze: 32_000 };
const BOARD_AREA_MM2 = BOARD.widthMm * BOARD.heightMm;

function actor(): CurrentSession {
  return { userId: uid(), role: 'ADMIN', name: 'Test Admin', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.stockConsumption.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.orderEvent.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await prisma.materialStock.deleteMany({ where: { notePl: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

async function seedMaterial() {
  return prisma.material.create({
    data: {
      slug: uid(),
      namePl: 'Dąb testowy',
      family: 'SOLID_WOOD',
      shortDescPl: 'Test',
      characteristicsPl: 'Test',
      imageUrl: '/images/photos/material-dab.jpg',
      pricePerM2Grosze: 10_000,
      densityKgPerM3: 600,
      maxSheetWidthMm: 2_000,
      maxSheetHeightMm: 1_250,
      minLineWidthUm: 500,
      minDetailSpacingUm: 500,
      minTextHeightUm: 2_000,
    },
  });
}

async function seedBatch(materialId: string, purchasedAt: Date, quantity = 1) {
  return prisma.materialStock.create({
    data: { materialId, ...BOARD, quantity, purchasedAt, notePl: `${PREFIX}batch` },
  });
}

/** An order sitting at CONFIRMED, the only status production can be entered from. */
async function seedConfirmedOrder(lines: readonly { materialId: string | null; widthMm: number | null; heightMm: number | null; quantity: number }[]) {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      status: 'CONFIRMED',
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
      phone: '+48123456789',
      firstName: 'Test',
      lastName: 'Test',
      street: 'Test 1',
      postalCode: '00-001',
      city: 'Test',
      subtotalNetGrosze: 100,
      vatGrosze: 23,
      shippingGrosze: 0,
      deliveryMethodNamePl: 'Test',
      totalGrossGrosze: 123,
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'Test',
      withdrawalAcknowledgedAt: new Date(),
      items: {
        create: lines.map((line) => ({
          quantity: line.quantity,
          unitNetGrosze: 100,
          unitGrossGrosze: 123,
          lineNetGrosze: 100,
          lineVatGrosze: 23,
          lineGrossGrosze: 123,
          pricingVersion: 1,
          materialId: line.materialId,
          snapshot: { widthMm: line.widthMm, heightMm: line.heightMm, thicknessMm: 18 },
        })),
      },
    },
  });
}

describe('entering production draws the order off the shelf', () => {
  it('takes the item area from the oldest batch and records what it took', async () => {
    const material = await seedMaterial();
    const newer = await seedBatch(material.id, new Date('2026-06-01T00:00:00Z'));
    const older = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    // Two 200x150 signs: 60 000 mm2, comfortably inside one board.
    const order = await seedConfirmedOrder([{ materialId: material.id, widthMm: 200, heightMm: 150, quantity: 2 }]);

    const result = await applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null);
    expect(result.ok).toBe(true);

    const drawn = await prisma.stockConsumption.findMany({ where: { orderId: order.id } });
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.materialStockId).toBe(older.id);
    expect(drawn[0]?.areaMm2).toBe(60_000);
    // 60 000 of 2 500 000 mm2 of a 32 000 gr board.
    expect(drawn[0]?.costGrosze).toBe(768);

    // And the running total the warehouse screen reads agrees with it.
    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: older.id } })).consumedAreaMm2).toBe(60_000);
    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: newer.id } })).consumedAreaMm2).toBe(0);
  });

  it('lets a second line see what the first one already took', async () => {
    // The reason the shelf is read per line rather than once for the order.
    // Planning both lines against one snapshot would hand out the same board
    // twice and the totals would silently exceed what was bought.
    const material = await seedMaterial();
    const batch = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    const half = { materialId: material.id, widthMm: 1_000, heightMm: 1_250, quantity: 1 };
    const order = await seedConfirmedOrder([half, half]);

    await applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null);

    const stock = await prisma.materialStock.findUniqueOrThrow({ where: { id: batch.id } });
    expect(stock.consumedAreaMm2).toBe(BOARD_AREA_MM2);

    const drawn = await prisma.stockConsumption.findMany({ where: { orderId: order.id } });
    expect(drawn).toHaveLength(2);
    expect(drawn.reduce((total, row) => total + row.areaMm2, 0)).toBe(BOARD_AREA_MM2);
  });

  it('spills into the next batch when the older one runs out mid-order', async () => {
    const material = await seedMaterial();
    const older = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    const newer = await seedBatch(material.id, new Date('2026-06-01T00:00:00Z'));
    // One and a half boards' worth.
    const order = await seedConfirmedOrder([{ materialId: material.id, widthMm: 2_000, heightMm: 1_250, quantity: 1 }, { materialId: material.id, widthMm: 1_000, heightMm: 1_250, quantity: 1 }]);

    await applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null);

    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: older.id } })).consumedAreaMm2).toBe(BOARD_AREA_MM2);
    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: newer.id } })).consumedAreaMm2).toBe(BOARD_AREA_MM2 / 2);
  });

  it('still moves the order into production when there is no stock recorded at all', async () => {
    // Production happens whether or not a delivery has been entered, so a
    // missing warehouse row must not block a real order. Nothing is invented
    // to make the numbers tidy either: no consumption row is written.
    const material = await seedMaterial();
    const order = await seedConfirmedOrder([{ materialId: material.id, widthMm: 200, heightMm: 150, quantity: 1 }]);

    const result = await applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null);

    expect(result.ok).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('IN_PRODUCTION');
    expect(await prisma.stockConsumption.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('ignores a line with no material and one with no recorded size', async () => {
    // A CUSTOM_UPLOAD line need not name a catalogue material, and an order
    // placed before this feature existed carries no link at all. Neither is
    // an error - there is simply no shelf to draw from.
    const material = await seedMaterial();
    const batch = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    const order = await seedConfirmedOrder([
      { materialId: null, widthMm: 200, heightMm: 150, quantity: 1 },
      { materialId: material.id, widthMm: null, heightMm: null, quantity: 1 },
    ]);

    const result = await applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null);

    expect(result.ok).toBe(true);
    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: batch.id } })).consumedAreaMm2).toBe(0);
  });

  it('draws nothing for a transition that is not into production', async () => {
    const material = await seedMaterial();
    const batch = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    const order = await seedConfirmedOrder([{ materialId: material.id, widthMm: 200, heightMm: 150, quantity: 1 }]);

    await applyOrderStatusTransition(actor(), order.orderNumber, 'CANCELLED', 'Klient zrezygnował.');

    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: batch.id } })).consumedAreaMm2).toBe(0);
    expect(await prisma.stockConsumption.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('draws once when two staff move the same order into production at the same time', async () => {
    // The consumption inherits P1-6's guard rather than adding its own: the
    // status `updateMany` refuses the loser, so only one transaction reaches
    // the shelf. Without that, a double-click would bill the order twice.
    const material = await seedMaterial();
    const batch = await seedBatch(material.id, new Date('2026-01-01T00:00:00Z'));
    const order = await seedConfirmedOrder([{ materialId: material.id, widthMm: 200, heightMm: 150, quantity: 1 }]);

    const results = await Promise.allSettled([
      applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null),
      applyOrderStatusTransition(actor(), order.orderNumber, 'IN_PRODUCTION', null),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.ok);
    expect(succeeded).toHaveLength(1);
    expect((await prisma.materialStock.findUniqueOrThrow({ where: { id: batch.id } })).consumedAreaMm2).toBe(30_000);
    expect(await prisma.stockConsumption.count({ where: { orderId: order.id } })).toBe(1);
  });
});

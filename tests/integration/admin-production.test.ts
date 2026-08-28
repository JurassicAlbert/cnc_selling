import { afterEach, describe, expect, it } from 'vitest';

import { getProductionCapacity, listOrderModuleManifest, listProductionQueue } from '@/server/repositories/admin-production';
import { prisma } from '@/server/db/client';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';
import type { OrderStatus } from '@/generated/prisma/enums';

const PREFIX = 'test-admin-production-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function buildSnapshot(overrides: Partial<OrderItemSnapshot> = {}): OrderItemSnapshot {
  return {
    productNamePl: 'Testowy produkt',
    designNamePl: null,
    designCode: null,
    materialNamePl: 'Dąb',
    finishNamePl: null,
    fontNamePl: null,
    widthMm: 1000,
    heightMm: 500,
    thicknessMm: 27,
    installationVariant: null,
    personalizationText: null,
    moduleLayout: {
      cols: 2,
      rows: 1,
      totalModules: 2,
      isModular: true,
      modules: [
        { code: 'A1', row: 0, col: 0, xMm: 0, yMm: 0, widthMm: 500, heightMm: 500, productionOrder: 1 },
        { code: 'A2', row: 0, col: 1, xMm: 500, yMm: 0, widthMm: 500, heightMm: 500, productionOrder: 2 },
      ],
    },
    // biome-ignore lint/suspicious/noExplicitAny: a minimal stub — this test never reads priceBreakdown, only widthMm/heightMm/moduleLayout/machiningMilliMinutesPerM2
    priceBreakdown: {} as any,
    machiningMilliMinutesPerM2: 2000,
    ...overrides,
  };
}

async function seedOrder(status: OrderStatus, itemSnapshots: readonly OrderItemSnapshot[]) {
  const order = await prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      status,
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
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
        create: itemSnapshots.map((snapshot) => ({
          quantity: 1,
          unitNetGrosze: 100,
          unitGrossGrosze: 123,
          lineNetGrosze: 100,
          lineVatGrosze: 23,
          lineGrossGrosze: 123,
          snapshot: snapshot as object,
          pricingVersion: 1,
        })),
      },
    },
  });
  return order;
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('listProductionQueue', () => {
  it('includes only production-stage orders, with correctly summed modules and area', async () => {
    // Asserts against its own seeded order specifically, not the queue's
    // total length — `listProductionQueue()` genuinely queries every
    // production-stage order in the database, not just this test's own
    // prefixed rows (there's no test-marker column on a real business
    // status), so other tests' orders sharing a status is expected, not a
    // bug: a `toHaveLength` assertion here would be the flaky one.
    const confirmed = await seedOrder('CONFIRMED', [buildSnapshot()]);
    const newOrder = await seedOrder('NEW', [buildSnapshot()]);
    const shipped = await seedOrder('SHIPPED', [buildSnapshot()]);

    const queue = await listProductionQueue();
    const orderNumbers = queue.map((q) => q.orderNumber);
    expect(orderNumbers).toContain(confirmed.orderNumber);
    expect(orderNumbers).not.toContain(newOrder.orderNumber);
    expect(orderNumbers).not.toContain(shipped.orderNumber);

    const entry = queue.find((q) => q.orderNumber === confirmed.orderNumber);
    expect(entry?.moduleCount).toBe(2);
    expect(entry?.areaM2).toBeCloseTo(0.5, 5); // 1000mm x 500mm = 0.5 m^2, quantity 1
  });

  it('sums modules and area across multiple items and quantities', async () => {
    const order = await seedOrder('IN_PRODUCTION', [
      buildSnapshot({ widthMm: 1000, heightMm: 1000 }), // 1 m^2, 2 modules
      buildSnapshot({ widthMm: 2000, heightMm: 1000, moduleLayout: { cols: 1, rows: 1, totalModules: 1, isModular: false, modules: [] } }), // 2 m^2, 1 module
    ]);

    const queue = await listProductionQueue();
    const entry = queue.find((q) => q.orderNumber === order.orderNumber);
    expect(entry?.moduleCount).toBe(3);
    expect(entry?.areaM2).toBeCloseTo(3, 5);
  });
});

describe('getProductionCapacity', () => {
  it('sums queued area and machine-minutes exactly, treating a null rate as zero minutes (real area still counted)', async () => {
    // Delta-based, not absolute: `getProductionCapacity()` genuinely sums
    // every production-stage order in the database, and other tests
    // running against the same shared database may have their own
    // production-stage orders in flight — a before/after comparison is
    // robust to that, an absolute-total assertion would not be.
    const before = await getProductionCapacity();

    await seedOrder('CONFIRMED', [buildSnapshot({ widthMm: 1000, heightMm: 1000, machiningMilliMinutesPerM2: 3000 })]); // 1 m^2 * 3 min/m^2 = 3 min
    await seedOrder('FINISHING', [buildSnapshot({ widthMm: 1000, heightMm: 2000, machiningMilliMinutesPerM2: null })]); // 2 m^2, 0 min (CUSTOM-style, unknown rate)
    await seedOrder('COMPLETED', [buildSnapshot({ widthMm: 5000, heightMm: 5000 })]); // not queued work, excluded entirely

    const after = await getProductionCapacity();
    expect(after.queuedAreaM2 - before.queuedAreaM2).toBeCloseTo(3, 5);
    expect(after.queuedMachineMinutes - before.queuedMachineMinutes).toBeCloseTo(3, 5);

    const machineSettings = await prisma.machineSettings.findUnique({ where: { id: 1 }, select: { weeklyCapacityMinutes: true } });
    expect(after.weeklyCapacityMinutes).toBe(machineSettings?.weeklyCapacityMinutes ?? 0);
  });
});

describe('listOrderModuleManifest', () => {
  it('returns the real module list from the immutable snapshot', async () => {
    const order = await seedOrder('CONFIRMED', [buildSnapshot()]);

    const manifest = await listOrderModuleManifest(order.orderNumber);
    expect(manifest).toHaveLength(1);
    expect(manifest[0]?.modules).toHaveLength(2);
    expect(manifest[0]?.modules[0]?.code).toBe('A1');
  });

  it('returns an empty array for a nonexistent order', async () => {
    expect(await listOrderModuleManifest('does-not-exist')).toEqual([]);
  });
});

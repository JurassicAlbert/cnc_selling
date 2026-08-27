import { afterEach, describe, expect, it } from 'vitest';

import { getDashboardKpis, getOrdersByStatus, getRevenueOverTime, getTopEntities } from '@/server/repositories/admin-dashboard';
import { prisma } from '@/server/db/client';
import type { OrderStatus } from '@/generated/prisma/enums';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';

const PREFIX = 'test-admin-dashboard-';

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
    widthMm: 500,
    heightMm: 500,
    thicknessMm: 27,
    installationVariant: null,
    personalizationText: null,
    moduleLayout: { cols: 1, rows: 1, totalModules: 1, isModular: false, modules: [] },
    // biome-ignore lint/suspicious/noExplicitAny: minimal stub — these tests never read priceBreakdown
    priceBreakdown: {} as any,
    machiningMilliMinutesPerM2: null,
    ...overrides,
  };
}

async function seedOrder(overrides: {
  readonly status?: OrderStatus;
  readonly paymentStatus?: 'AWAITING' | 'PAID';
  readonly createdAt?: Date;
  readonly subtotalNetGrosze?: number;
  readonly totalGrossGrosze?: number;
  readonly items?: readonly { readonly snapshot: OrderItemSnapshot; readonly quantity?: number; readonly lineGrossGrosze?: number }[];
}) {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      status: overrides.status ?? 'NEW',
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: overrides.paymentStatus ?? 'AWAITING',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
      firstName: 'Test',
      lastName: 'Test',
      street: 'Test 1',
      postalCode: '00-001',
      city: 'Test',
      subtotalNetGrosze: overrides.subtotalNetGrosze ?? 1000,
      vatGrosze: 230,
      shippingGrosze: 0,
      totalGrossGrosze: overrides.totalGrossGrosze ?? 1230,
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'Test',
      withdrawalAcknowledgedAt: new Date(),
      createdAt: overrides.createdAt ?? new Date(),
      items: {
        create: (overrides.items ?? []).map((item) => ({
          quantity: item.quantity ?? 1,
          unitNetGrosze: 1000,
          unitGrossGrosze: 1230,
          lineNetGrosze: 1000,
          lineVatGrosze: 230,
          lineGrossGrosze: item.lineGrossGrosze ?? 1230,
          snapshot: item.snapshot as object,
          pricingVersion: 1,
        })),
      },
    },
  });
}

async function seedCustomerDesign(status: 'PENDING_REVIEW' | 'APPROVED') {
  const sessionToken = uid();
  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: `admin-dashboard-test-${crypto.randomUUID()}`,
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
  return prisma.customerDesign.create({ data: { fileId: file.id, sessionToken, status } });
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('getDashboardKpis', () => {
  // `getDashboardKpis` is deliberately unscoped (no test-fixture-prefix
  // filter — it queries every real order, matching its real production
  // purpose). Every assertion below is therefore a BEFORE/AFTER delta
  // across this test's own fixtures, never an absolute value — asserting
  // e.g. `ordersToday === 2` would be flaky under `npm test`'s parallel
  // test-file execution, where other files' own fixtures (created with the
  // same real `createdAt: now()` default) transiently exist in the same
  // shared database. A prior version of this test asserted absolutes and
  // failed exactly this way the first time it ran inside the full suite.
  it('counts orders in each window regardless of status, but only sums revenue for non-CANCELLED orders', async () => {
    const now = new Date();
    const before = await getDashboardKpis(now);

    await seedOrder({ createdAt: now, status: 'NEW', subtotalNetGrosze: 1000, totalGrossGrosze: 1230 });
    await seedOrder({ createdAt: now, status: 'CANCELLED', subtotalNetGrosze: 5000, totalGrossGrosze: 6150 });

    const after = await getDashboardKpis(now);

    expect(after.ordersToday - before.ordersToday).toBe(2); // both today's orders count, cancelled included
    expect(after.orders30d - before.orders30d).toBe(2);
    expect(after.revenueNet30dGrosze - before.revenueNet30dGrosze).toBe(1000); // cancelled order's 5000 excluded
    expect(after.revenueGross30dGrosze - before.revenueGross30dGrosze).toBe(1230);
  });

  it('counts orders awaiting payment, pending design reviews, and in-production orders correctly', async () => {
    const before = await getDashboardKpis();

    await seedOrder({ paymentStatus: 'AWAITING' });
    await seedCustomerDesign('PENDING_REVIEW');
    await seedOrder({ status: 'IN_PRODUCTION', paymentStatus: 'PAID' }); // PAID: must not also count toward ordersAwaitingPayment

    const after = await getDashboardKpis();

    expect(after.ordersAwaitingPayment - before.ordersAwaitingPayment).toBe(1);
    expect(after.designsAwaitingReview - before.designsAwaitingReview).toBe(1);
    expect(after.ordersInProduction - before.ordersInProduction).toBe(1);
  });

  it('an order outside the 30-day window changes neither revenue nor AOV', async () => {
    const now = new Date();
    const before = await getDashboardKpis(now);

    await seedOrder({ createdAt: new Date(now.getTime() - 40 * DAY_MS), subtotalNetGrosze: 999_999, totalGrossGrosze: 999_999 });

    const after = await getDashboardKpis(now);

    expect(after.revenueNet30dGrosze).toBe(before.revenueNet30dGrosze);
    expect(after.revenueGross30dGrosze).toBe(before.revenueGross30dGrosze);
    expect(after.averageOrderValueGrosze).toBe(before.averageOrderValueGrosze);
    expect(after.orders30d).toBe(before.orders30d); // 40 days ago is outside the 30-day window entirely
  });
});

describe('getRevenueOverTime', () => {
  it('fills every day in the range and buckets revenue by day, excluding CANCELLED orders', async () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-03T23:59:59.999Z');
    await seedOrder({ createdAt: new Date('2026-01-01T10:00:00.000Z'), subtotalNetGrosze: 1000, totalGrossGrosze: 1230 });
    await seedOrder({ createdAt: new Date('2026-01-01T14:00:00.000Z'), subtotalNetGrosze: 500, totalGrossGrosze: 615 });
    await seedOrder({ createdAt: new Date('2026-01-03T09:00:00.000Z'), status: 'CANCELLED', subtotalNetGrosze: 9999, totalGrossGrosze: 9999 });

    const points = await getRevenueOverTime({ from, to });

    expect(points.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(points[0]).toMatchObject({ netGrosze: 1500, grossGrosze: 1845 });
    expect(points[1]).toMatchObject({ netGrosze: 0, grossGrosze: 0 });
    expect(points[2]).toMatchObject({ netGrosze: 0, grossGrosze: 0 }); // cancelled order excluded
  });
});

describe('getOrdersByStatus', () => {
  it('counts orders created within the range, grouped by status', async () => {
    const from = new Date('2026-02-01T00:00:00.000Z');
    const to = new Date('2026-02-28T23:59:59.999Z');
    await seedOrder({ createdAt: new Date('2026-02-05T00:00:00.000Z'), status: 'NEW' });
    await seedOrder({ createdAt: new Date('2026-02-06T00:00:00.000Z'), status: 'NEW' });
    await seedOrder({ createdAt: new Date('2026-02-07T00:00:00.000Z'), status: 'COMPLETED' });
    await seedOrder({ createdAt: new Date('2026-03-01T00:00:00.000Z'), status: 'NEW' }); // outside range

    const counts = await getOrdersByStatus({ from, to });

    expect(counts.get('NEW')).toBe(2);
    expect(counts.get('COMPLETED')).toBe(1);
    expect(counts.get('CANCELLED') ?? 0).toBe(0);
  });
});

describe('getTopEntities', () => {
  it('ranks by revenue, descending, excluding CANCELLED orders', async () => {
    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-31T23:59:59.999Z');
    const createdAt = new Date('2026-03-10T00:00:00.000Z');

    await seedOrder({
      createdAt,
      items: [{ snapshot: buildSnapshot({ productNamePl: 'Obraz A' }), lineGrossGrosze: 1000 }],
    });
    await seedOrder({
      createdAt,
      items: [{ snapshot: buildSnapshot({ productNamePl: 'Obraz B' }), lineGrossGrosze: 5000 }],
    });
    await seedOrder({
      createdAt,
      status: 'CANCELLED',
      items: [{ snapshot: buildSnapshot({ productNamePl: 'Obraz C (anulowany)' }), lineGrossGrosze: 99999 }],
    });

    const top = await getTopEntities({ from, to }, 'product', 5);

    expect(top.map((t) => t.name)).toEqual(['Obraz B', 'Obraz A']); // Obraz C excluded (cancelled), sorted desc
    expect(top[0]).toMatchObject({ name: 'Obraz B', revenueGrosze: 5000 });
  });

  it('groups designs by name (falling back to code) and materials by name, skipping entries with no name', async () => {
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T23:59:59.999Z');
    const createdAt = new Date('2026-04-10T00:00:00.000Z');

    await seedOrder({
      createdAt,
      items: [
        { snapshot: buildSnapshot({ designNamePl: null, designCode: 'W-014', materialNamePl: null }), lineGrossGrosze: 2000 },
      ],
    });

    const topDesigns = await getTopEntities({ from, to }, 'design', 5);
    const topMaterials = await getTopEntities({ from, to }, 'material', 5);

    expect(topDesigns).toEqual([{ name: 'W-014', revenueGrosze: 2000, quantity: 1 }]);
    expect(topMaterials).toEqual([]); // materialNamePl is null — CUSTOM-style item, correctly skipped
  });
});

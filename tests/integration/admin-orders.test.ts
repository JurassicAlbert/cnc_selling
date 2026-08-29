import { afterEach, describe, expect, it } from 'vitest';

import { applyMarkOrderPaid, applyOrderStatusTransition } from '@/server/actions/admin-orders';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

/**
 * `applyOrderStatusTransition`/`applyMarkOrderPaid` — the pure halves of
 * `admin-orders.ts`'s Server Actions (staff actor passed explicitly, same
 * split `auth.test.ts` uses for `mergeGuestCartIntoUser`). The wrapping
 * Server Actions themselves (`transitionOrderStatus`/`markOrderPaid`) call
 * `requireStaffSession()`, which reads `next/headers` and can only run
 * inside a real request — proven end-to-end instead by
 * `tests/e2e/admin-authz.spec.ts`, including the `CUSTOMER` → 404 case.
 */

const PREFIX = 'test-admin-orders-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.orderEvent.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

async function seedOrder(overrides: {
  readonly status?: 'NEW' | 'AWAITING_PAYMENT' | 'DESIGN_REVIEW' | 'CONFIRMED';
  readonly paymentMethod?: 'BANK_TRANSFER' | 'CONTACT_ARRANGED';
  readonly paymentStatus?: 'AWAITING' | 'PAID';
}) {
  const orderNumber = uid();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      accessToken: uid(),
      status: overrides.status ?? 'NEW',
      paymentMethod: overrides.paymentMethod ?? 'BANK_TRANSFER',
      paymentStatus: overrides.paymentStatus ?? 'AWAITING',
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
    },
  });
  return order;
}

async function seedCustomerDesign(status: 'PENDING_REVIEW' | 'APPROVED') {
  const sessionToken = uid();
  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: `admin-orders-test-${crypto.randomUUID()}`,
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
  return prisma.customerDesign.create({ data: { fileId: file.id, sessionToken, status } });
}

describe('applyOrderStatusTransition', () => {
  it('a legal transition updates status, writes an OrderEvent, and audits it', async () => {
    const order = await seedOrder({ status: 'NEW' });
    const staff = staffActor();

    const result = await applyOrderStatusTransition(staff, order.orderNumber, 'CONFIRMED', null);
    expect(result).toEqual({ ok: true });

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('CONFIRMED');

    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: 'NEW', toStatus: 'CONFIRMED', actorType: 'staff', actorEmail: staff.email });

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: order.id } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({ entity: 'Order', action: 'transition', actorEmail: staff.email });
  });

  it('an illegal transition is rejected and leaves the order untouched', async () => {
    const order = await seedOrder({ status: 'NEW' });

    const result = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'SHIPPED', null);
    expect(result.ok).toBe(false);

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('NEW');
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('CANCELLED requires a non-empty note', async () => {
    const order = await seedOrder({ status: 'NEW' });

    const withoutNote = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CANCELLED', null);
    expect(withoutNote.ok).toBe(false);
    const withBlankNote = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CANCELLED', '   ');
    expect(withBlankNote.ok).toBe(false);

    const withNote = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CANCELLED', 'Klient zrezygnował telefonicznie.');
    expect(withNote.ok).toBe(true);
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events[0]?.notePl).toBe('Klient zrezygnował telefonicznie.');
  });

  it('the DESIGN_REVIEW gate blocks the exit edge until the linked design is APPROVED, then allows it', async () => {
    const order = await seedOrder({ status: 'DESIGN_REVIEW' });
    const pendingDesign = await seedCustomerDesign('PENDING_REVIEW');
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        quantity: 1,
        unitNetGrosze: 100,
        unitGrossGrosze: 123,
        lineNetGrosze: 100,
        lineVatGrosze: 23,
        lineGrossGrosze: 123,
        snapshot: {},
        pricingVersion: 1,
        customerDesignId: pendingDesign.id,
      },
    });

    const blocked = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CONFIRMED', null);
    expect(blocked.ok).toBe(false);

    await prisma.customerDesign.update({ where: { id: pendingDesign.id }, data: { status: 'APPROVED' } });

    const allowed = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CONFIRMED', null);
    expect(allowed.ok).toBe(true);
  });
});

describe('applyMarkOrderPaid', () => {
  it('marks a bank-transfer order paid and audits it', async () => {
    const order = await seedOrder({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'AWAITING' });
    const staff = staffActor();

    const result = await applyMarkOrderPaid(staff, order.orderNumber);
    expect(result).toEqual({ ok: true });

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('PAID');
    expect(await prisma.auditLog.count({ where: { entityId: order.id, action: 'update' } })).toBe(1);
  });

  it('rejects a CONTACT_ARRANGED order — nothing to mark paid', async () => {
    const order = await seedOrder({ paymentMethod: 'CONTACT_ARRANGED' });
    expect((await applyMarkOrderPaid(staffActor(), order.orderNumber)).ok).toBe(false);
  });

  it('rejects an order already marked paid', async () => {
    const order = await seedOrder({ paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID' });
    expect((await applyMarkOrderPaid(staffActor(), order.orderNumber)).ok).toBe(false);
  });
});

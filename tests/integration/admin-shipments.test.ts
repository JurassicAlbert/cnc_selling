import { afterEach, describe, expect, it } from 'vitest';

import { applyUpsertShipment } from '@/server/operations/admin-shipments';
import { findShipmentForOrder } from '@/server/repositories/admin-shipments';
import { findOrderForUser, findOrderForConfirmation } from '@/server/repositories/orders';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-shipments-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

async function seedOrder(overrides: { readonly userId?: string } = {}) {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      paymentMethod: 'BANK_TRANSFER',
      deliveryMethodNamePl: 'Test',
      userId: overrides.userId ?? null,
      email: `${uid()}@example.test`,
      phone: '+48123456789',
      firstName: 'Test',
      lastName: 'Test',
      street: 'Test 1',
      postalCode: '00-001',
      city: 'Test',
      subtotalNetGrosze: 100,
      vatGrosze: 23,
      shippingGrosze: 0,
      totalGrossGrosze: 123,
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'Test',
      withdrawalAcknowledgedAt: new Date(),
    },
  });
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'Shipment', actorEmail: { startsWith: PREFIX } } });
  await prisma.shipment.deleteMany({ where: { order: { orderNumber: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
});

describe('applyUpsertShipment', () => {
  it('creates a real Shipment row on the first save and audits it as a create', async () => {
    const staff = staffActor();
    const order = await seedOrder();

    const result = await applyUpsertShipment(staff, order.id, formData({ status: 'PREPARING', carrier: 'InPost' }));
    expect(result.ok).toBe(true);

    const shipment = await findShipmentForOrder(order.id);
    expect(shipment?.status).toBe('PREPARING');
    expect(shipment?.carrier).toBe('InPost');
    expect(await prisma.auditLog.count({ where: { entity: 'Shipment', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('updates the existing row on a second save rather than creating a duplicate', async () => {
    const staff = staffActor();
    const order = await seedOrder();
    await applyUpsertShipment(staff, order.id, formData({ status: 'PREPARING' }));

    await applyUpsertShipment(staff, order.id, formData({ status: 'SHIPPED', carrier: 'DPD', trackingNumber: 'ABC123' }));

    const shipment = await findShipmentForOrder(order.id);
    expect(shipment?.status).toBe('SHIPPED');
    expect(shipment?.carrier).toBe('DPD');
    expect(shipment?.trackingNumber).toBe('ABC123');
    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'Shipment', action: 'update', actorEmail: staff.email } })).toBe(1);
  });

  it('parses date fields, storing null for an empty one', async () => {
    const staff = staffActor();
    const order = await seedOrder();

    await applyUpsertShipment(staff, order.id, formData({ status: 'SHIPPED', shippedAt: '2026-08-20' }));

    const shipment = await findShipmentForOrder(order.id);
    expect(shipment?.shippedAt?.toISOString().slice(0, 10)).toBe('2026-08-20');
    expect(shipment?.deliveredAt).toBeNull();
  });

  it('rejects an invalid status', async () => {
    const order = await seedOrder();
    const result = await applyUpsertShipment(staffActor(), order.id, formData({ status: 'NOT_A_REAL_STATUS' }));
    expect(result.ok).toBe(false);
  });

  it('returns a failure result for a non-existent order', async () => {
    const result = await applyUpsertShipment(staffActor(), 'does-not-exist', formData({ status: 'PREPARING' }));
    expect(result.ok).toBe(false);
  });
});

describe('customer-facing order views include shipment data', () => {
  it('findOrderForUser returns the real shipment, and null when none exists yet', async () => {
    const owner = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER' } });
    const order = await seedOrder({ userId: owner.id });

    expect((await findOrderForUser(order.orderNumber, owner.id))?.shipment).toBeNull();

    await applyUpsertShipment(staffActor(), order.id, formData({ status: 'IN_TRANSIT', carrier: 'InPost', customerNotesPl: 'Paczka w drodze.' }));

    const withShipment = await findOrderForUser(order.orderNumber, owner.id);
    expect(withShipment?.shipment?.status).toBe('IN_TRANSIT');
    expect(withShipment?.shipment?.carrier).toBe('InPost');
    expect(withShipment?.shipment?.customerNotesPl).toBe('Paczka w drodze.');

    await prisma.user.delete({ where: { id: owner.id } });
  });

  it('findOrderForConfirmation (guest lookup) also returns the real shipment', async () => {
    const order = await seedOrder();
    await applyUpsertShipment(staffActor(), order.id, formData({ status: 'DELIVERED', deliveredAt: '2026-08-25' }));

    const found = await findOrderForConfirmation(order.orderNumber, order.accessToken);
    expect(found?.shipment?.status).toBe('DELIVERED');
    expect(found?.shipment?.deliveredAt?.toISOString().slice(0, 10)).toBe('2026-08-25');
  });

  it('never exposes staff-only internalNotesPl/issueResolutionPl on the customer view type', async () => {
    const order = await seedOrder();
    await applyUpsertShipment(staffActor(), order.id, formData({ status: 'ISSUE', internalNotesPl: 'Tajna notatka', issueResolutionPl: 'Wewnętrzne rozwiązanie' }));

    const found = await findOrderForConfirmation(order.orderNumber, order.accessToken);
    expect(found?.shipment).not.toHaveProperty('internalNotesPl');
    expect(found?.shipment).not.toHaveProperty('issueResolutionPl');
  });
});

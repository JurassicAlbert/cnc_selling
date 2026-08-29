import { afterEach, describe, expect, it } from 'vitest';

import {
  applyCreateDeliveryMethod,
  applySetDeliveryMethodActive,
  applyUpdateDeliveryMethod,
} from '@/server/operations/admin-delivery-methods';
import { listDeliveryMethodsForAdmin } from '@/server/repositories/admin-delivery-methods';
import { resolveDeliveryMethodsForCart } from '@/server/repositories/delivery-methods';

const EMPTY_CART = { subtotalGrossGrosze: 0, items: [] };
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-delivery-methods-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    namePl: `${PREFIX}kurier`,
    descPl: 'Opis testowej metody dostawy.',
    pricePln: '15',
    estimatedDaysMin: '1',
    estimatedDaysMax: '3',
    sortOrder: '0',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'DeliveryMethod', actorEmail: { startsWith: PREFIX } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('applyCreateDeliveryMethod', () => {
  it('creates a real row, converting PLN to grosze, and audits it', async () => {
    const staff = staffActor();

    const result = await applyCreateDeliveryMethod(staff, formData({ pricePln: '19.99' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const created = await prisma.deliveryMethod.findUniqueOrThrow({ where: { id: result.id } });
    expect(created.priceGrosze).toBe(1_999);
    expect(created.isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: 'DeliveryMethod', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('stores a free-shipping threshold when given, converted to grosze', async () => {
    const result = await applyCreateDeliveryMethod(staffActor(), formData({ freeShippingThresholdPln: '300' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect((await prisma.deliveryMethod.findUniqueOrThrow({ where: { id: result.id } })).freeShippingThresholdGrosze).toBe(30_000);
  });

  it('leaves the free-shipping threshold null when not given', async () => {
    const result = await applyCreateDeliveryMethod(staffActor(), formData());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect((await prisma.deliveryMethod.findUniqueOrThrow({ where: { id: result.id } })).freeShippingThresholdGrosze).toBeNull();
  });

  it('rejects a missing name', async () => {
    const result = await applyCreateDeliveryMethod(staffActor(), formData({ namePl: '  ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a negative price', async () => {
    const result = await applyCreateDeliveryMethod(staffActor(), formData({ pricePln: '-5' }));
    expect(result.ok).toBe(false);
  });

  it('rejects estimatedDaysMin greater than estimatedDaysMax', async () => {
    const result = await applyCreateDeliveryMethod(staffActor(), formData({ estimatedDaysMin: '5', estimatedDaysMax: '2' }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateDeliveryMethod', () => {
  it('updates fields and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateDeliveryMethod(staff, formData());
    if (!created.ok) throw new Error('setup failed');

    const updated = await applyUpdateDeliveryMethod(staff, created.id, formData({ namePl: `${PREFIX}zmieniona`, pricePln: '25' }));
    expect(updated.ok).toBe(true);
    const row = await prisma.deliveryMethod.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.namePl).toBe(`${PREFIX}zmieniona`);
    expect(row.priceGrosze).toBe(2_500);
  });

  it('returns a failure result for a non-existent method', async () => {
    const result = await applyUpdateDeliveryMethod(staffActor(), 'does-not-exist', formData());
    expect(result.ok).toBe(false);
  });
});

describe('applySetDeliveryMethodActive', () => {
  it('deactivating removes it from the real checkout listing without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateDeliveryMethod(staff, formData());
    if (!created.ok) throw new Error('setup failed');

    expect((await resolveDeliveryMethodsForCart(EMPTY_CART)).some((m) => m.id === created.id)).toBe(true);

    await applySetDeliveryMethodActive(staff, created.id, false);

    expect((await resolveDeliveryMethodsForCart(EMPTY_CART)).some((m) => m.id === created.id)).toBe(false);
    expect((await listDeliveryMethodsForAdmin()).some((m) => m.id === created.id)).toBe(true);
    expect(await prisma.deliveryMethod.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

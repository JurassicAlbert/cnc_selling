import { afterEach, describe, expect, it } from 'vitest';

import {
  applyAddDeliveryWeightTier,
  applyCreateDeliveryMethod,
  applyRemoveDeliveryWeightTier,
  applySetDeliveryMethodActive,
  applyUpdateDeliveryMethod,
} from '@/server/operations/admin-delivery-methods';
import type { DeliveryWeightTierInput } from '@/server/operations/admin-delivery-methods';
import { findDeliveryMethodForAdmin, listDeliveryMethodsForAdmin } from '@/server/repositories/admin-delivery-methods';
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

/**
 * `docs/AUDIT-2026-08-30.md` §20 (admin CRUD consistency). `DeliveryWeightTier`
 * is what actually decides what a customer is charged for a tiered carrier —
 * `DeliveryMethod.priceGrosze` is only the fallback for a method with no
 * tiers at all. Yet the panel had no way to see or edit tiers: an admin could
 * change "Cena" on an InPost or DPD method and nothing about the real charge
 * would move. Not a cosmetic gap — an actively misleading one.
 */
describe('delivery weight tiers — admin CRUD', () => {
  async function seedMethod() {
    const staff = staffActor();
    const created = await applyCreateDeliveryMethod(staff, formData());
    if (!created.ok) throw new Error('setup failed — could not create a delivery method');
    return { staff, id: created.id };
  }

  function tierInput(overrides: Partial<DeliveryWeightTierInput> = {}): DeliveryWeightTierInput {
    return {
      labelPl: 'do 5 kg',
      maxWeightGrams: 5_000,
      priceGrosze: 1_599,
      maxWidthMm: null,
      maxHeightMm: null,
      maxDepthMm: null,
      ...overrides,
    };
  }

  it('adds a tier, and the tier is what the customer-facing resolver then charges', async () => {
    const { staff, id } = await seedMethod();

    const result = await applyAddDeliveryWeightTier(staff, id, tierInput());
    expect(result.ok).toBe(true);

    const method = await findDeliveryMethodForAdmin(id);
    expect(method?.weightTiers).toHaveLength(1);
    expect(method?.weightTiers[0]).toMatchObject({ labelPl: 'do 5 kg', maxWeightGrams: 5_000, priceGrosze: 1_599 });

    // The real proof: an empty cart resolved through the SAME function
    // checkout uses now charges the tier price, not the method's own
    // `priceGrosze` (1500 gr, from `formData()`'s `pricePln: '15'`).
    const resolved = await resolveDeliveryMethodsForCart(EMPTY_CART);
    expect(resolved.find((m) => m.id === id)).toMatchObject({ feasible: true, priceGrosze: 1_599 });
  });

  it('rejects a tier with a non-positive weight — a 0 g bracket would match everything', async () => {
    const { staff, id } = await seedMethod();
    expect((await applyAddDeliveryWeightTier(staff, id, tierInput({ maxWeightGrams: 0 }))).ok).toBe(false);
    expect((await findDeliveryMethodForAdmin(id))?.weightTiers).toHaveLength(0);
  });

  it('rejects a negative price rather than silently paying the customer to ship', async () => {
    const { staff, id } = await seedMethod();
    expect((await applyAddDeliveryWeightTier(staff, id, tierInput({ priceGrosze: -1 }))).ok).toBe(false);
  });

  it('keeps tiers ordered cheapest-bracket-first however they were entered', async () => {
    const { staff, id } = await seedMethod();
    await applyAddDeliveryWeightTier(staff, id, tierInput({ labelPl: 'do 20 kg', maxWeightGrams: 20_000, priceGrosze: 2_999 }));
    await applyAddDeliveryWeightTier(staff, id, tierInput({ labelPl: 'do 2 kg', maxWeightGrams: 2_000, priceGrosze: 1_199 }));

    const method = await findDeliveryMethodForAdmin(id);
    expect(method?.weightTiers.map((tier) => tier.maxWeightGrams)).toEqual([2_000, 20_000]);
  });

  it('removes a tier, and removing the last one falls the method back to its own flat price', async () => {
    const { staff, id } = await seedMethod();
    await applyAddDeliveryWeightTier(staff, id, tierInput());
    const withTier = await findDeliveryMethodForAdmin(id);
    const tierId = withTier?.weightTiers[0]?.id;
    if (tierId === undefined) throw new Error('setup failed — no tier to remove');

    await applyRemoveDeliveryWeightTier(staff, id, tierId);

    expect((await findDeliveryMethodForAdmin(id))?.weightTiers).toHaveLength(0);
    const resolved = await resolveDeliveryMethodsForCart(EMPTY_CART);
    expect(resolved.find((m) => m.id === id)).toMatchObject({ priceGrosze: 1_500 });
  });

  it('writes an audit entry for both adding and removing a tier', async () => {
    const { staff, id } = await seedMethod();
    await applyAddDeliveryWeightTier(staff, id, tierInput());
    const tierId = (await findDeliveryMethodForAdmin(id))?.weightTiers[0]?.id;
    if (tierId === undefined) throw new Error('setup failed');
    await applyRemoveDeliveryWeightTier(staff, id, tierId);

    expect(
      await prisma.auditLog.count({ where: { entity: 'DeliveryMethod', entityId: id, actorEmail: staff.email } }),
    ).toBeGreaterThanOrEqual(2);
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import {
  applyAddDeliveryInsuranceTier,
  applyAddDeliveryWeightTier,
  applyCreateDeliveryMethod,
  applyRemoveDeliveryInsuranceTier,
  applyRemoveDeliveryWeightTier,
  applySetDeliveryMethodActive,
  applyUpdateDeliveryMethod,
} from '@/server/operations/admin-delivery-methods';
import type { DeliveryInsuranceTierInput, DeliveryWeightTierInput } from '@/server/operations/admin-delivery-methods';
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
 * is what actually decides what a customer is charged for a tiered carrier -
 * `DeliveryMethod.priceGrosze` is only the fallback for a method with no
 * tiers at all. Yet the panel had no way to see or edit tiers: an admin could
 * change "Cena" on an InPost or DPD method and nothing about the real charge
 * would move. Not a cosmetic gap - an actively misleading one.
 */
describe('delivery weight tiers - admin CRUD', () => {
  async function seedMethod() {
    const staff = staffActor();
    const created = await applyCreateDeliveryMethod(staff, formData());
    if (!created.ok) throw new Error('setup failed - could not create a delivery method');
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

  it('rejects a tier with a non-positive weight - a 0 g bracket would match everything', async () => {
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
    if (tierId === undefined) throw new Error('setup failed - no tier to remove');

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

/**
 * INSURANCE-01. The screen that unblocks the item.
 *
 * The owner chose the carrier's real declared-value table over a flat fee or
 * a percentage, and neither InPost nor DPD publishes one citably - so the
 * bands cannot be seeded, only typed in from the rate card the owner holds.
 * Until they are, `insurance` is `null` on every method and no customer sees
 * anything, which is the same "you are not allowed to lie" rule that keeps
 * `Kurier GEIS` inactive.
 *
 * Audited against `DeliveryMethod`, like the weight tiers: these are edits to
 * one method's pricing and belong on that method's activity timeline.
 */
/** By id rather than by position: the resolver returns every active method. */
async function resolveOne(id: string, subtotalGrossGrosze: number) {
  const all = await resolveDeliveryMethodsForCart({ ...EMPTY_CART, subtotalGrossGrosze });
  return all.find((method) => method.id === id) ?? null;
}

describe('delivery insurance bands - admin CRUD', () => {
  async function seedMethod() {
    const staff = staffActor();
    const created = await applyCreateDeliveryMethod(staff, formData());
    if (!created.ok) throw new Error('setup failed - could not create a delivery method');
    return { staff, id: created.id };
  }

  function bandInput(overrides: Partial<DeliveryInsuranceTierInput> = {}): DeliveryInsuranceTierInput {
    return { labelPl: 'do 1000 zł', maxValueGrosze: 100_000, priceGrosze: 300, ...overrides };
  }

  it('adds a band, and the band is what the customer-facing resolver then offers', async () => {
    const { staff, id } = await seedMethod();

    const result = await applyAddDeliveryInsuranceTier(staff, id, bandInput());
    expect(result.ok).toBe(true);

    const method = await findDeliveryMethodForAdmin(id);
    expect(method?.insuranceTiers).toHaveLength(1);

    // The point of the screen: what an admin types is what a customer is
    // offered, through the one resolver checkout and `createOrder` share.
    // Found by id, not taken as `[0]` - other files create delivery methods
    // in parallel against this database.
    const resolved = await resolveOne(id, 50_000);
    expect(resolved?.insurance).toEqual({ labelPl: 'do 1000 zł', priceGrosze: 300 });
  });

  it('turns the offer on for a method that had none, and off again when the last band goes', async () => {
    const { staff, id } = await seedMethod();

    // Before: no table, so nothing is offered. This is every method today.
    expect((await resolveOne(id, 50_000))?.insurance).toBeNull();

    const added = await applyAddDeliveryInsuranceTier(staff, id, bandInput());
    if (!added.ok) throw new Error('setup failed - could not add a band');
    const method = await findDeliveryMethodForAdmin(id);
    const bandId = method?.insuranceTiers[0]?.id;
    expect(bandId).toBeDefined();
    if (bandId === undefined) return;

    await applyRemoveDeliveryInsuranceTier(staff, id, bandId);

    expect((await findDeliveryMethodForAdmin(id))?.insuranceTiers).toHaveLength(0);
    expect((await resolveOne(id, 50_000))?.insurance).toBeNull();
  });

  it('refuses a band that covers nothing', async () => {
    const { staff, id } = await seedMethod();

    // A 0 zł ceiling would band no real order, and being the cheapest it
    // would win the sort - the same trap `validateWeightTier` guards against
    // with a 0 g bracket.
    const result = await applyAddDeliveryInsuranceTier(staff, id, bandInput({ maxValueGrosze: 0 }));

    expect(result.ok).toBe(false);
    expect((await findDeliveryMethodForAdmin(id))?.insuranceTiers).toHaveLength(0);
  });

  it('refuses a band with no name and a band with a negative premium', async () => {
    const { staff, id } = await seedMethod();

    expect((await applyAddDeliveryInsuranceTier(staff, id, bandInput({ labelPl: '   ' }))).ok).toBe(false);
    expect((await applyAddDeliveryInsuranceTier(staff, id, bandInput({ priceGrosze: -1 }))).ok).toBe(false);
    expect((await findDeliveryMethodForAdmin(id))?.insuranceTiers).toHaveLength(0);
  });

  it('refuses to add a band to a method that does not exist', async () => {
    const staff = staffActor();

    const result = await applyAddDeliveryInsuranceTier(staff, 'does-not-exist', bandInput());

    expect(result.ok).toBe(false);
  });

  it('leaves a past order alone when the band it was sold under is removed', async () => {
    const { staff, id } = await seedMethod();
    const added = await applyAddDeliveryInsuranceTier(staff, id, bandInput());
    if (!added.ok) throw new Error('setup failed - could not add a band');

    // What a checkout snapshotted. `Order.insuranceGrosze`/`insuranceLabelPl`
    // are copies, not references, exactly like `shippingGrosze` - so this is
    // the assertion that a rate-card edit cannot rewrite history.
    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        accessToken: uid(),
        paymentMethod: 'BANK_TRANSFER',
        email: `${PREFIX}buyer@example.test`,
        phone: '600100200',
        firstName: 'Ala',
        lastName: 'Kowalska',
        street: 'Kwiatowa 5',
        postalCode: '30-001',
        city: 'Kraków',
        subtotalNetGrosze: 10_000,
        vatGrosze: 2_300,
        shippingGrosze: 1_500,
        insuranceGrosze: 300,
        insuranceLabelPl: 'do 1000 zł',
        totalGrossGrosze: 14_100,
        deliveryMethodNamePl: 'Kurier',
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'test',
        withdrawalAcknowledgedAt: new Date(),
      },
    });

    const method = await findDeliveryMethodForAdmin(id);
    const bandId = method?.insuranceTiers[0]?.id;
    if (bandId === undefined) throw new Error('setup failed - no band to remove');
    await applyRemoveDeliveryInsuranceTier(staff, id, bandId);

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after?.insuranceGrosze).toBe(300);
    expect(after?.insuranceLabelPl).toBe('do 1000 zł');

    await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });
});

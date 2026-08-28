import { afterEach, describe, expect, it } from 'vitest';

import { applyCreatePricingDraft, applyPublishPricingVersion } from '@/server/actions/admin-pricing';
import type { PricingDraftInput } from '@/server/actions/admin-pricing';
import { getActivePricingVersion, getPricingVersionByNumber } from '@/server/repositories/admin-pricing';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-pricing-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function adminActor(): CurrentSession {
  return { userId: uid(), role: 'ADMIN', name: 'Test Admin', email: `${PREFIX}${crypto.randomUUID()}@example.test` };
}

function draftInput(overrides: Partial<PricingDraftInput> = {}): PricingDraftInput {
  return {
    machineRateCncGrosze: 15_000,
    machineRateLaserGrosze: 12_000,
    moduleSurchargeGrosze: 4_000,
    vatRateBp: 2_300,
    packagingTiers: [
      { maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 },
      { maxAreaM2: null, maxModules: null, priceGrosze: 9_000 },
    ],
    notePl: 'test draft',
    ...overrides,
  };
}

const createdVersions: number[] = [];

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  if (createdVersions.length > 0) {
    await prisma.pricingSettings.deleteMany({ where: { version: { in: createdVersions } } });
    createdVersions.length = 0;
  }
});

describe('applyCreatePricingDraft', () => {
  it('creates a new, inactive version — never mutates the currently active one', async () => {
    const before = await getActivePricingVersion();
    const admin = adminActor();

    const result = await applyCreatePricingDraft(admin, draftInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('setup failed');
    createdVersions.push(result.version);

    const draft = await getPricingVersionByNumber(result.version);
    expect(draft?.isActive).toBe(false);
    expect(draft?.publishedAt).toBeNull();

    const after = await getActivePricingVersion();
    expect(after?.version).toBe(before?.version); // untouched
    expect(await prisma.auditLog.count({ where: { entity: 'PricingSettings', entityId: String(result.version), action: 'create', actorEmail: admin.email } })).toBe(1);
  });

  it('rejects a negative rate', async () => {
    const result = await applyCreatePricingDraft(adminActor(), draftInput({ machineRateCncGrosze: -1 }));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty packaging-tier list', async () => {
    const result = await applyCreatePricingDraft(adminActor(), draftInput({ packagingTiers: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects a packaging-tier table whose last row is not a real catch-all — packagingGroszeFor throws on an unmatched size otherwise', async () => {
    const result = await applyCreatePricingDraft(
      adminActor(),
      draftInput({ packagingTiers: [{ maxAreaM2: 1, maxModules: 1, priceGrosze: 1_500 }] }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('applyPublishPricingVersion', () => {
  it('atomically swaps which single version is active, and audits the diff', async () => {
    const admin = adminActor();
    const before = await getActivePricingVersion();
    const created = await applyCreatePricingDraft(admin, draftInput({ machineRateCncGrosze: 99_999 }));
    if (!created.ok) throw new Error('setup failed');
    createdVersions.push(created.version);

    const result = await applyPublishPricingVersion(admin, created.version);
    expect(result.ok).toBe(true);

    const nowActive = await getActivePricingVersion();
    expect(nowActive?.version).toBe(created.version);
    expect(nowActive?.machineRateCncGrosze).toBe(99_999);

    if (before !== null) {
      const oldRow = await getPricingVersionByNumber(before.version);
      expect(oldRow?.isActive).toBe(false);
    }

    expect(
      await prisma.auditLog.count({ where: { entity: 'PricingSettings', entityId: String(created.version), action: 'transition', actorEmail: admin.email } }),
    ).toBe(1);

    // Restore the real active version so this test doesn't leave the dev/test DB pointed at a throwaway rate set.
    if (before !== null) {
      await applyPublishPricingVersion(admin, before.version);
    }
  });

  it('rejects publishing an already-active version', async () => {
    const active = await getActivePricingVersion();
    if (active === null) throw new Error('no active PricingSettings row in this DB — seed first');

    const result = await applyPublishPricingVersion(adminActor(), active.version);
    expect(result.ok).toBe(false);
  });

  it('rejects publishing a nonexistent version', async () => {
    const result = await applyPublishPricingVersion(adminActor(), 987_654_321);
    expect(result.ok).toBe(false);
  });

  it('an order created under the old version keeps its exact stored price after a new version is published with very different rates — the load-bearing invariant', async () => {
    const admin = adminActor();
    const activeBefore = await getActivePricingVersion();
    if (activeBefore === null) throw new Error('no active PricingSettings row in this DB — seed first');

    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        accessToken: uid(),
        status: 'NEW',
        paymentMethod: 'BANK_TRANSFER',
        email: `${PREFIX}${crypto.randomUUID()}@example.test`,
        firstName: 'Test',
        lastName: 'Test',
        street: 'Test 1',
        postalCode: '00-001',
        city: 'Test',
        subtotalNetGrosze: 100_00,
        vatGrosze: 23_00,
        shippingGrosze: 0,
        deliveryMethodNamePl: 'Test',
        totalGrossGrosze: 123_00,
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'Test',
        withdrawalAcknowledgedAt: new Date(),
        items: {
          create: {
            quantity: 1,
            unitNetGrosze: 100_00,
            unitGrossGrosze: 123_00,
            lineNetGrosze: 100_00,
            lineVatGrosze: 23_00,
            lineGrossGrosze: 123_00,
            snapshot: { productNamePl: 'Test product', pricedUnderVersion: activeBefore.version },
            pricingVersion: activeBefore.version,
          },
        },
      },
      include: { items: true },
    });

    const created = await applyCreatePricingDraft(
      admin,
      draftInput({ machineRateCncGrosze: 999_999, machineRateLaserGrosze: 999_999, moduleSurchargeGrosze: 999_999 }),
    );
    if (!created.ok) throw new Error('setup failed');
    createdVersions.push(created.version);
    await applyPublishPricingVersion(admin, created.version);

    const [seededItem] = order.items;
    if (seededItem === undefined) throw new Error('setup failed');
    const itemAfter = await prisma.orderItem.findUniqueOrThrow({ where: { id: seededItem.id } });
    expect(itemAfter.lineGrossGrosze).toBe(123_00);
    expect(itemAfter.pricingVersion).toBe(activeBefore.version);
    expect(itemAfter.snapshot).toEqual({ productNamePl: 'Test product', pricedUnderVersion: activeBefore.version });

    // Restore.
    await applyPublishPricingVersion(admin, activeBefore.version);
  });
});

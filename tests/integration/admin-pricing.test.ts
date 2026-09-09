import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { applyCreatePricingDraft, applyPublishPricingVersion, applySimulatePricingDraft } from '@/server/operations/admin-pricing';
import type { PricingDraftInput } from '@/server/operations/admin-pricing';
import { getActivePricingVersion, getPricingVersionByNumber } from '@/server/repositories/admin-pricing';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { TEST_PRICING_NOTE_PREFIX, publishesPricingVersions, restoreActivePricingVersion } from './pricing-fixture';

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
    notePl: `${TEST_PRICING_NOTE_PREFIX}admin-pricing`,
    ...overrides,
  };
}

/**
 * Which version was live before this file ran anything.
 *
 * Restoring it belongs here rather than at the end of each test, and that is
 * a repair, not tidiness. Two tests used to publish a throwaway version and
 * republish the real one on the last line - which never runs when an earlier
 * assertion throws. On 2026-09-08 a failing test did exactly that, the
 * `afterEach` below then deleted the throwaway row, and the test database was
 * left with NO active pricing version at all (the deletion is gone as of
 * T-32; capturing the version once, up here, is what fixed this): every later test in the file
 * failed with "no active PricingSettings row - seed first", which reads like
 * a missing seed rather than like the previous test's wreckage.
 */
let originallyActiveVersion: number | null = null;

/*
  T-32. This file publishes pricing versions, which moves every price on the
  site for as long as one of them is live, so it runs with nothing else
  pricing anything. Declared before the hook below on purpose: Vitest's
  default hook order is "stack", so the lock is taken before the active
  version is read and given back after it has been restored.
*/
publishesPricingVersions();

beforeAll(async () => {
  originallyActiveVersion = (await getActivePricingVersion())?.version ?? null;
});

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  /*
    T-32, and both halves of this are about the rest of the suite rather than
    about this file. Measured, not reasoned about - `pricing-fixture.ts`
    carries the numbers.

    **The swap back is one transaction now.** It used to be two statements,
    and between them the database had no active pricing version at all: 13
    such windows in a 90 000-read probe of this file running alone. That is
    exactly what `getConfiguratorProductData` refuses to price against, so
    any file loading a product inside one failed with "No
    `obraz-drewniany-z-grawerem` in this database", which reads like a
    missing seed.

    **And the versions this file published are no longer deleted here.** One
    of them was seen active by another connection 180 times and then removed,
    which is `Configuration_pricingVersion_fkey`. A row another worker has
    already read is not this file's to delete; `global-setup.ts` sweeps them
    once the run is over and nothing else is looking.

    Still directly rather than through `applyPublishPricingVersion`:
    publishing demands a simulation stamp, and this is cleanup, not a thing
    under test.
  */
  if (originallyActiveVersion !== null) {
    await restoreActivePricingVersion(originallyActiveVersion);
  }
});

describe('applyCreatePricingDraft', () => {
  it('creates a new, inactive version - never mutates the currently active one', async () => {
    const before = await getActivePricingVersion();
    const admin = adminActor();

    const result = await applyCreatePricingDraft(admin, draftInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('setup failed');

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

  it('rejects a packaging-tier table whose last row is not a real catch-all - packagingGroszeFor throws on an unmatched size otherwise', async () => {
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
    // BUG-34: publishing now requires a recorded simulation. Part of the
    // setup here rather than the subject - the subject is the atomic swap.
    await applySimulatePricingDraft(admin, created.version);

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

    // No inline restore: `afterEach` puts the originally-active version back
    // whatever happens above, including when an assertion throws first.
  });

  it('rejects publishing an already-active version', async () => {
    const active = await getActivePricingVersion();
    if (active === null) throw new Error('no active PricingSettings row in this DB - seed first');

    const result = await applyPublishPricingVersion(adminActor(), active.version);
    expect(result.ok).toBe(false);
  });

  it('rejects publishing a nonexistent version', async () => {
    const result = await applyPublishPricingVersion(adminActor(), 987_654_321);
    expect(result.ok).toBe(false);
  });

  it('an order created under the old version keeps its exact stored price after a new version is published with very different rates - the load-bearing invariant', async () => {
    const admin = adminActor();
    const activeBefore = await getActivePricingVersion();
    if (activeBefore === null) throw new Error('no active PricingSettings row in this DB - seed first');

    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        accessToken: uid(),
        status: 'NEW',
        paymentMethod: 'BANK_TRANSFER',
        email: `${PREFIX}${crypto.randomUUID()}@example.test`,
        phone: '+48123456789',
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
    await applySimulatePricingDraft(admin, created.version);
    /*
      Asserted, not fired and forgotten. This line used to ignore its result,
      and when BUG-34's interlock landed the publish started being REFUSED -
      leaving a test named "after a new version is published" that published
      nothing and passed anyway, because an order's stored price survives
      doing nothing even better than it survives a republish.
    */
    expect((await applyPublishPricingVersion(admin, created.version)).ok).toBe(true);

    const [seededItem] = order.items;
    if (seededItem === undefined) throw new Error('setup failed');
    const itemAfter = await prisma.orderItem.findUniqueOrThrow({ where: { id: seededItem.id } });
    expect(itemAfter.lineGrossGrosze).toBe(123_00);
    expect(itemAfter.pricingVersion).toBe(activeBefore.version);
    expect(itemAfter.snapshot).toEqual({ productNamePl: 'Test product', pricedUnderVersion: activeBefore.version });

  });
});

/**
 * `docs/AI-CHECKLIST.md` BUG-34, plus two defects found while fixing it.
 *
 * §16A.1 module 7 calls this "the highest-risk screen in the application:
 * a mistyped rate changes every price on the site", and R14 names the
 * mandatory simulator as the mitigation. So all three of these are about
 * the same guarantee: that a human really saw what a publish would do.
 */
describe('the simulator is the interlock, so it has to be real', () => {
  it('refuses to publish a version nobody has simulated', async () => {
    const admin = adminActor();
    const created = await applyCreatePricingDraft(admin, draftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await applyPublishPricingVersion(admin, created.version);
    expect(result.ok).toBe(false);

    // And it really did not publish - the guard is not just a message.
    expect((await getPricingVersionByNumber(created.version))?.isActive).toBe(false);
  });

  it('publishes once the simulation has actually run', async () => {
    const admin = adminActor();
    const created = await applyCreatePricingDraft(admin, draftInput());
    if (!created.ok) throw new Error('setup failed');

    const simulated = await applySimulatePricingDraft(admin, created.version);
    expect(simulated.ok).toBe(true);

    expect((await applyPublishPricingVersion(admin, created.version)).ok).toBe(true);

  });

  it('records who reviewed it and when, and keeps the first reviewer on a second look', async () => {
    const first = adminActor();
    const second = adminActor();
    const created = await applyCreatePricingDraft(first, draftInput());
    if (!created.ok) throw new Error('setup failed');

    expect((await getPricingVersionByNumber(created.version))?.simulatedAt).toBeNull();

    await applySimulatePricingDraft(first, created.version);
    const afterFirst = await getPricingVersionByNumber(created.version);
    expect(afterFirst?.simulatedByEmail).toBe(first.email);
    expect(afterFirst?.simulatedAt).toBeInstanceOf(Date);

    await applySimulatePricingDraft(second, created.version);
    const afterSecond = await getPricingVersionByNumber(created.version);
    expect(afterSecond?.simulatedByEmail).toBe(first.email);
    expect(afterSecond?.simulatedAt).toEqual(afterFirst?.simulatedAt);
  });

  it('prices only products a customer could actually buy today', async () => {
    /*
      The rot this replaces: the reference set was three hard-coded slugs,
      and two of them - `panele-podlogowe` (2026-08-28) and `stolek-loftowy`
      (2026-09-04) - had since been retired with their categories. The
      mandatory review table was showing one priceable row out of three and
      two raw slugs where names should have been, and nothing failed.
    */
    const admin = adminActor();
    // Its own throwaway draft rather than the live version: simulating writes
    // now, and a test that stamps a seeded row leaves the next one reading
    // state this one created.
    const created = await applyCreatePricingDraft(admin, draftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await applySimulatePricingDraft(admin, created.version);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      const product = await prisma.product.findUnique({
        where: { slug: row.slug },
        select: { isActive: true, namePl: true, category: { select: { isActive: true } } },
      });
      expect(product?.isActive).toBe(true);
      expect(product?.category.isActive).toBe(true);
      // A name, never the slug standing in for one.
      expect(row.namePl).toBe(product?.namePl);
    }
    expect(result.rows.some((row) => row.status === 'ok')).toBe(true);
  });

  it('shows a packaging-only change as a change, because packaging is part of the unit price', async () => {
    /*
      `toDraftPricingRow` copied the draft's four rates but kept the ACTIVE
      version's packaging tiers, so a draft that raised packaging alone
      simulated as "no change" - on the one screen whose entire job is to
      say what a publish will do. `packagingGrosze` is added into the unit
      net price in `domain/pricing/calculate.ts`, so it was never cosmetic.
    */
    const admin = adminActor();
    const active = await getActivePricingVersion();
    if (active === null) throw new Error('no active PricingSettings row in this DB - seed first');

    // Same rates as the live version; only the packaging table differs.
    const created = await applyCreatePricingDraft(
      admin,
      draftInput({
        machineRateCncGrosze: active.machineRateCncGrosze,
        machineRateLaserGrosze: active.machineRateLaserGrosze,
        moduleSurchargeGrosze: active.moduleSurchargeGrosze,
        vatRateBp: active.vatRateBp,
        packagingTiers: [{ maxAreaM2: null, maxModules: null, priceGrosze: 999_00 }],
      }),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await applySimulatePricingDraft(admin, created.version);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const priced = result.rows.filter((row) => row.status === 'ok');
    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      expect(row.draftGrossGrosze).not.toBe(row.currentGrossGrosze);
    }
  });
});

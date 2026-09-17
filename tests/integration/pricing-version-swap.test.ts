/**
 * `docs/AI-CHECKLIST.md` T-32.
 *
 * One invariant, asserted from outside the transaction that is supposed to
 * hold it: **while the active price list is being swapped, nobody ever sees
 * the catalogue without one.**
 *
 * That is a business rule before it is a test-suite rule.
 * `getConfiguratorProductData` returns `null` when no `PricingSettings` row
 * is active - a deliberate refusal to price against nothing, not a bug - and
 * every product page, every add-to-cart and every checkout goes through it.
 * A publish that deactivates the old version and activates the new one in two
 * separate statements makes the entire shop unbuyable for the length of the
 * gap, and the failure it produces says "no such product", which points at
 * the seed rather than at the swap.
 *
 * **Deterministic, not hopeful.** The gap is sub-millisecond, so polling for
 * it is how a race gets called "unreproducible". Instead the swap is held
 * open: another connection takes a `FOR UPDATE` row lock on the version the
 * swap is about to write, which blocks that statement for as long as the lock
 * is held, and the state is read from a third connection while it is stuck
 * there. A plain `SELECT` is never blocked by a row lock in Postgres, so the
 * reader sees exactly what a real request would see at that instant: the
 * pre-swap state if the two statements share a transaction, and nothing at
 * all if they do not.
 *
 * The measurement that started this is in `pricing-fixture.ts`: 13 moments
 * with no active pricing version in a 90 000-read probe of one file's
 * cleanup, and one version observed active 180 times that had been deleted
 * by the end of the run.
 */

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { applyCreatePricingDraft, applyPublishPricingVersion, applySimulatePricingDraft } from '@/server/operations/admin-pricing';
import { getActivePricingVersion } from '@/server/repositories/admin-pricing';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { TEST_PRICING_NOTE_PREFIX, publishesPricingVersions, restoreActivePricingVersion } from './pricing-fixture';

const PREFIX = 'test-pricing-swap-';

/** The product `create-order.test.ts` prices, and the one that broke. */
const PRICEABLE_PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';

function adminActor(): CurrentSession {
  return {
    userId: `${PREFIX}${crypto.randomUUID()}`,
    role: 'ADMIN',
    name: 'Test Admin',
    email: `${PREFIX}${crypto.randomUUID()}@example.test`,
  };
}

function draftInput(machineRateCncGrosze: number) {
  return {
    machineRateCncGrosze,
    machineRateLaserGrosze: 12_000,
    moduleSurchargeGrosze: 4_000,
    vatRateBp: 2_300,
    packagingTiers: [
      { maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 },
      { maxAreaM2: null, maxModules: null, priceGrosze: 9_000 },
    ],
    notePl: `${TEST_PRICING_NOTE_PREFIX}swap`,
  };
}

/**
 * Hold a row lock on one pricing version, and hand back the release.
 *
 * Its own `pg.Client` rather than Prisma for the reason `singleton-lock.ts`
 * gives about advisory locks, and it applies just as hard here: a row lock
 * belongs to the transaction that took it, and Prisma pools, so a `BEGIN` and
 * a `COMMIT` issued as two `$executeRaw` calls can land on different
 * connections and the lock outlives the test.
 */
async function holdRowLock(version: number): Promise<() => Promise<void>> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('holdRowLock needs DATABASE_URL - see tests/integration/env-setup.ts');
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT version FROM "PricingSettings" WHERE version = $1 FOR UPDATE', [version]);
  return async () => {
    try {
      await client.query('COMMIT');
    } finally {
      await client.end();
    }
  };
}

/** Long enough for the blocked statement to actually be blocked. */
const BLOCKED_MS = 400;

let originallyActiveVersion: number;

/*
  The same exclusion `admin-pricing.test.ts` takes, and this file is why the
  need is not theoretical: it was the second publisher, and the first run with
  both of them failed on `PricingSettings_single_active` - the partial unique
  index over `isActive`. Two files publishing at once do not interleave, they
  collide.
*/
publishesPricingVersions();

beforeAll(async () => {
  const active = await getActivePricingVersion();
  if (active === null) {
    throw new Error('No active PricingSettings row - seed it first (npm run db:seed:test)');
  }
  originallyActiveVersion = active.version;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await restoreActivePricingVersion(originallyActiveVersion);
  // The versions this file created are deliberately left in place and swept
  // by `global-setup.ts` once the run is over. See `pricing-fixture.ts`.
});

describe('swapping the active pricing version', () => {
  it('never leaves the catalogue with no price list, even mid-swap', async () => {
    /*
      The precondition is asserted before anything is locked, so a missing
      seed fails here with its own message rather than looking like the race
      this test is about.
    */
    expect(await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG)).not.toBeNull();

    const created = await applyCreatePricingDraft(adminActor(), draftInput(88_888));
    if (!created.ok) throw new Error('setup failed: could not create a draft');
    await restoreActivePricingVersion(created.version);

    // Block the swap back at the statement that re-activates the original.
    const release = await holdRowLock(originallyActiveVersion);
    const swap = restoreActivePricingVersion(originallyActiveVersion);

    try {
      await new Promise((resolve) => setTimeout(resolve, BLOCKED_MS));

      const activeMidSwap = await prisma.pricingSettings.findFirst({ where: { isActive: true }, select: { version: true } });
      expect(activeMidSwap).not.toBeNull();

      // The consequence, which is what a customer would have hit: with no
      // active version this is `null` and the product page has nothing to
      // price.
      expect(await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG)).not.toBeNull();
    } finally {
      await release();
      await swap;
    }

    expect((await getActivePricingVersion())?.version).toBe(originallyActiveVersion);
  });

  it('never leaves the catalogue with no price list while a real publish is in flight', async () => {
    /*
      The same invariant on the production path. `applyPublishPricingVersion`
      already runs both statements in one transaction and its own test calls
      that "atomically"; this is the assertion that makes the word mean
      something observable, because the end state it checks would look
      identical either way.

      Here the lock is on the currently active version, so it is the
      *deactivating* statement that blocks - the first of the two - which is
      why a reader must still see the old version rather than nothing.
    */
    const admin = adminActor();
    const created = await applyCreatePricingDraft(admin, draftInput(77_777));
    if (!created.ok) throw new Error('setup failed: could not create a draft');
    await applySimulatePricingDraft(admin, created.version);

    const release = await holdRowLock(originallyActiveVersion);
    const publish = applyPublishPricingVersion(admin, created.version);

    try {
      await new Promise((resolve) => setTimeout(resolve, BLOCKED_MS));

      const activeMidPublish = await prisma.pricingSettings.findFirst({ where: { isActive: true }, select: { version: true } });
      expect(activeMidPublish?.version).toBe(originallyActiveVersion);
      expect(await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG)).not.toBeNull();
    } finally {
      await release();
      expect((await publish).ok).toBe(true);
    }

    expect((await getActivePricingVersion())?.version).toBe(created.version);
    await restoreActivePricingVersion(originallyActiveVersion);
  });
});

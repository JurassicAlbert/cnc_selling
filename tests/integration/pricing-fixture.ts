/**
 * Mutual exclusion and cleanup for the one row that sets every price on the
 * site.
 *
 * `PricingSettings` is a singleton in the same sense as `StoreSettings`, and
 * the database says so outright: `PricingSettings_single_active` is a partial
 * unique index over `isActive`, so "exactly one version is live" is enforced
 * rather than merely intended. What is *not* enforced is that there is always
 * one, and that is where T-32 lived.
 *
 * **The difference from `singleton-lock.ts`, and why this is its own key.**
 * `StoreSettings` and `EmailTemplate` are written by a few files and read by
 * the same few. `PricingSettings` is written by two files and *read* by most
 * of the suite, through `getConfiguratorProductData`,
 * `priceAndValidateSelections`, `applyAddToCart` and `createOrder`. One
 * exclusive lock only excludes the files that take it, so making every reader
 * take it would serialise the suite. A reader/writer pair does not:
 * `pg_advisory_lock_shared` lets every reader run at once and blocks only
 * while a publisher holds the exclusive lock.
 *
 * **Measured on 2026-09-09, not reasoned about.** A probe polling `isActive`
 * from its own connection while `admin-pricing.test.ts` ran recorded, in
 * 90 179 reads:
 *
 * - **13 moments with no active pricing version at all.** The file's
 *   `afterEach` deactivated the throwaway version and re-activated the
 *   original in two separate statements, so between them there was none.
 *   `getConfiguratorProductData` returns `null` when nothing is active - a
 *   deliberate refusal to price against nothing - so any file loading a
 *   product inside one of those windows failed with "No
 *   `obraz-drewniany-z-grawerem` in this database", which reads like a
 *   missing seed and is not.
 * - **A version observed active 180 times that no longer existed** by the end
 *   of the run, because the same `afterEach` deleted it. Anything that read
 *   it as active and then wrote a `Configuration` failed on
 *   `Configuration_pricingVersion_fkey` - the exact error
 *   `cart-operations.test.ts` reported.
 *
 * After the swap became one transaction and the deletes moved to
 * `global-setup.ts`, the same probe under a full parallel suite: **0 null
 * sightings, 0 versions vanished.**
 *
 * A third mechanism only showed up once those two were closed: publishing
 * recomputes and stores the advertised "od X zł" for every product, so a file
 * that published a throwaway version at 88 888 gr/h left `starting-price.test.ts`
 * comparing a real configuration against a figure derived from rates that no
 * longer existed (`expected 19532 to be greater than or equal to 28129`).
 * Releasing the exclusive lock refreshes them, which is what production does
 * on the same event.
 */

import pg from 'pg';
import { afterAll, beforeAll } from 'vitest';

import { prisma } from '@/server/db/client';
import { refreshStartingPricesAfterCatalogueChange } from '@/server/pricing/starting-price';

// Re-exported so a test file needs one import for "mark it and swap it
// safely" rather than two. The constant itself lives with the sweep that acts
// on it, which has no application imports of its own.
export { TEST_PRICING_NOTE_PREFIX } from './global-setup';

/**
 * Its own key, deliberately not `singleton-lock.ts`'s. Nothing takes both, so
 * there is no lock ordering to get wrong and no way to deadlock the two
 * against each other.
 */
const PRICING_LOCK_KEY = 918_273_642;

const TAKE = { exclusive: 'pg_advisory_lock', shared: 'pg_advisory_lock_shared' } as const;
const GIVE = { exclusive: 'pg_advisory_unlock', shared: 'pg_advisory_unlock_shared' } as const;

/**
 * Take the pricing lock, and hand back the release.
 *
 * Its own `pg.Client` rather than Prisma, for the reason `singleton-lock.ts`
 * sets out at length: a session-level advisory lock belongs to the connection
 * that took it, and Prisma pools, so a `$executeRaw` lock and a `$executeRaw`
 * unlock can land on different connections and the lock is never released.
 *
 * Releasing an exclusive hold refreshes the advertised starting prices first.
 * That is not tidiness: publishing rates is exactly the event production
 * hooks `refreshStartingPricesAfterCatalogueChange` to, and a file that
 * published a throwaway version has left every "od X zł" derived from rates
 * that are about to stop being live. Doing it inside the release means it
 * happens while the lock is still held, so no reader can see the half-way
 * state, and a file cannot forget.
 */
async function acquirePricingLock(mode: 'exclusive' | 'shared'): Promise<() => Promise<void>> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('acquirePricingLock needs DATABASE_URL - see tests/integration/env-setup.ts');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Blocks until it is this file's turn. No timeout on purpose, same as
    // `singleton-lock.ts`: Vitest's own deadline is the backstop.
    await client.query(`SELECT ${TAKE[mode]}($1)`, [PRICING_LOCK_KEY]);
  } catch (error) {
    await client.end();
    throw error;
  }

  return async () => {
    try {
      if (mode === 'exclusive') {
        await refreshStartingPricesAfterCatalogueChange();
      }
      await client.query(`SELECT ${GIVE[mode]}($1)`, [PRICING_LOCK_KEY]);
    } finally {
      await client.end();
    }
  };
}

/**
 * Declare that this file prices things against whatever version is live.
 *
 * One call at the top of the file. The hooks are registered here rather than
 * copied into each caller so that the ordering is right by construction:
 * Vitest's default `sequence.hooks` is `"stack"`, so the `beforeAll`
 * registered first runs first and the `afterAll` registered first runs last -
 * which is exactly "take the lock before anything else, give it back after
 * everything else".
 *
 * Shared, so every reader still runs in parallel with every other reader.
 */
export function readsActivePricing(): void {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await acquirePricingLock('shared');
  });

  afterAll(async () => {
    await release?.();
    release = null;
  });
}

/**
 * Declare that this file publishes pricing versions, and so moves every price
 * on the site while it runs.
 *
 * Exclusive: no reader, and no other publisher, runs alongside it. The second
 * half matters as much as the first - two files publishing at once do not
 * merely interleave, they fail on `PricingSettings_single_active`.
 */
export function publishesPricingVersions(): void {
  let release: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    release = await acquirePricingLock('exclusive');
  });

  afterAll(async () => {
    await release?.();
    release = null;
  });
}

/**
 * Put `version` back in charge, in one transaction.
 *
 * The two statements are the pair `applyPublishPricingVersion` runs, in the
 * same order, for the same reason: `version` is a `@id`, so "exactly one
 * active row" cannot be expressed as a constraint over the transition, and a
 * transaction is what makes the gap between them unobservable to anyone else.
 *
 * Not routed through `applyPublishPricingVersion` on purpose - that demands a
 * recorded simulation (BUG-34), and this is cleanup rather than a thing under
 * test.
 */
export async function restoreActivePricingVersion(version: number): Promise<void> {
  await prisma.$transaction([
    prisma.pricingSettings.updateMany({ where: { isActive: true, version: { not: version } }, data: { isActive: false } }),
    prisma.pricingSettings.update({ where: { version }, data: { isActive: true } }),
  ]);
}

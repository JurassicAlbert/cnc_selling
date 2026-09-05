'use server';

/**
 * Server Action surface for `@/server/operations/admin-pricing` - the thin half.
 *
 * Every export of a `'use server'` module is a public HTTP endpoint, so
 * this file exports ONLY the session-deriving wrappers. The real logic,
 * and the `apply*(actor, …)` functions integration tests call directly,
 * live in the operations module, which is a plain module and therefore
 * reachable only from server code that already authenticated the caller.
 *
 * See `docs/AUDIT-2026-08-30.md` P0-1 for the hole this closed, and
 * `tests/unit/server-action-boundary.test.ts` for the guard that keeps it
 * closed. Forwarding via `Parameters`/`ReturnType` rather than a copied
 * signature is deliberate: it cannot drift from the real one.
 */

import * as operations from '@/server/operations/admin-pricing';

export type { PackagingTierInput, PricingDraftInput, PricingDraftResult, PublishPricingResult, PricingSimulationRow, SimulatePricingResult } from '@/server/operations/admin-pricing';

export async function createPricingDraft(
  ...args: Parameters<typeof operations.createPricingDraft>
): ReturnType<typeof operations.createPricingDraft> {
  return operations.createPricingDraft(...args);
}

export async function publishPricingVersion(
  ...args: Parameters<typeof operations.publishPricingVersion>
): ReturnType<typeof operations.publishPricingVersion> {
  return operations.publishPricingVersion(...args);
}

export async function simulatePricingDraft(
  ...args: Parameters<typeof operations.simulatePricingDraft>
): ReturnType<typeof operations.simulatePricingDraft> {
  return operations.simulatePricingDraft(...args);
}

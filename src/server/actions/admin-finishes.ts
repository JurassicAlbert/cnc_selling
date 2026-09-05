'use server';

/**
 * Server Action surface for `@/server/operations/admin-finishes` - the thin half.
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

import * as operations from '@/server/operations/admin-finishes';

export type { FinishMutationResult } from '@/server/operations/admin-finishes';

export async function createFinish(
  ...args: Parameters<typeof operations.createFinish>
): ReturnType<typeof operations.createFinish> {
  return operations.createFinish(...args);
}

export async function updateFinish(
  ...args: Parameters<typeof operations.updateFinish>
): ReturnType<typeof operations.updateFinish> {
  return operations.updateFinish(...args);
}

export async function setFinishSortOrder(
  ...args: Parameters<typeof operations.setFinishSortOrder>
): ReturnType<typeof operations.setFinishSortOrder> {
  return operations.setFinishSortOrder(...args);
}

export async function setFinishAvailable(
  ...args: Parameters<typeof operations.setFinishAvailable>
): ReturnType<typeof operations.setFinishAvailable> {
  return operations.setFinishAvailable(...args);
}

export async function bulkSetFinishAvailable(
  ...args: Parameters<typeof operations.bulkSetFinishAvailable>
): ReturnType<typeof operations.bulkSetFinishAvailable> {
  return operations.bulkSetFinishAvailable(...args);
}

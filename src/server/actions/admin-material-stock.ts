'use server';

/**
 * Server Action surface for `@/server/operations/admin-material-stock` - the
 * thin half.
 *
 * Every export of a `'use server'` module is a public HTTP endpoint, so this
 * file exports ONLY the session-deriving wrappers. The real logic, and the
 * `apply*(actor, ...)` functions integration tests call directly, live in the
 * operations module, which is a plain module and therefore reachable only
 * from server code that already authenticated the caller.
 *
 * See `docs/AUDIT-2026-08-30.md` P0-1 for the hole this closed, and
 * `tests/unit/server-action-boundary.test.ts` for the guard that keeps it
 * closed.
 */

import * as operations from '@/server/operations/admin-material-stock';

export type { StockBatchInput, StockMutationResult } from '@/server/operations/admin-material-stock';

export async function createStockBatch(
  ...args: Parameters<typeof operations.createStockBatch>
): ReturnType<typeof operations.createStockBatch> {
  return operations.createStockBatch(...args);
}

export async function adjustStockQuantity(
  ...args: Parameters<typeof operations.adjustStockQuantity>
): ReturnType<typeof operations.adjustStockQuantity> {
  return operations.adjustStockQuantity(...args);
}

export async function deleteStockBatch(
  ...args: Parameters<typeof operations.deleteStockBatch>
): ReturnType<typeof operations.deleteStockBatch> {
  return operations.deleteStockBatch(...args);
}

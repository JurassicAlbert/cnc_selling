'use server';

/**
 * Server Action surface for `@/server/operations/admin-products` — the thin half.
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

import * as operations from '@/server/operations/admin-products';

export type { ProductCoreInput, ProductMutationResult, ProductCsvRowResult, ImportProductsResult } from '@/server/operations/admin-products';

export async function createProduct(
  ...args: Parameters<typeof operations.createProduct>
): ReturnType<typeof operations.createProduct> {
  return operations.createProduct(...args);
}

export async function updateProduct(
  ...args: Parameters<typeof operations.updateProduct>
): ReturnType<typeof operations.updateProduct> {
  return operations.updateProduct(...args);
}

export async function setProductActive(
  ...args: Parameters<typeof operations.setProductActive>
): ReturnType<typeof operations.setProductActive> {
  return operations.setProductActive(...args);
}

export async function bulkSetProductActive(
  ...args: Parameters<typeof operations.bulkSetProductActive>
): ReturnType<typeof operations.bulkSetProductActive> {
  return operations.bulkSetProductActive(...args);
}

export async function setProductSortOrder(
  ...args: Parameters<typeof operations.setProductSortOrder>
): ReturnType<typeof operations.setProductSortOrder> {
  return operations.setProductSortOrder(...args);
}

export async function duplicateProduct(
  ...args: Parameters<typeof operations.duplicateProduct>
): ReturnType<typeof operations.duplicateProduct> {
  return operations.duplicateProduct(...args);
}

export async function duplicateProductAndGo(
  ...args: Parameters<typeof operations.duplicateProductAndGo>
): ReturnType<typeof operations.duplicateProductAndGo> {
  return operations.duplicateProductAndGo(...args);
}

export async function importProductsFromCsv(
  ...args: Parameters<typeof operations.importProductsFromCsv>
): ReturnType<typeof operations.importProductsFromCsv> {
  return operations.importProductsFromCsv(...args);
}

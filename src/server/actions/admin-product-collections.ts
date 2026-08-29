'use server';

/**
 * Server Action surface for `@/server/operations/admin-product-collections` — the thin half.
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

import * as operations from '@/server/operations/admin-product-collections';

export type { ProductCollectionFormInput, ProductCollectionMutationResult, ProductCollectionItemResult } from '@/server/operations/admin-product-collections';

export async function createProductCollection(
  ...args: Parameters<typeof operations.createProductCollection>
): ReturnType<typeof operations.createProductCollection> {
  return operations.createProductCollection(...args);
}

export async function updateProductCollection(
  ...args: Parameters<typeof operations.updateProductCollection>
): ReturnType<typeof operations.updateProductCollection> {
  return operations.updateProductCollection(...args);
}

export async function setProductCollectionActive(
  ...args: Parameters<typeof operations.setProductCollectionActive>
): ReturnType<typeof operations.setProductCollectionActive> {
  return operations.setProductCollectionActive(...args);
}

export async function setProductCollectionItem(
  ...args: Parameters<typeof operations.setProductCollectionItem>
): ReturnType<typeof operations.setProductCollectionItem> {
  return operations.setProductCollectionItem(...args);
}

export async function removeProductCollectionItem(
  ...args: Parameters<typeof operations.removeProductCollectionItem>
): ReturnType<typeof operations.removeProductCollectionItem> {
  return operations.removeProductCollectionItem(...args);
}

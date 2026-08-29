'use server';

/**
 * Server Action surface for `@/server/operations/admin-designs` — the thin half.
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

import * as operations from '@/server/operations/admin-designs';

export type { CollectionFormInput, CollectionMutationResult, CollectionCsvRowResult, ImportCollectionsResult, DesignMutationResult } from '@/server/operations/admin-designs';

export async function createCollection(
  ...args: Parameters<typeof operations.createCollection>
): ReturnType<typeof operations.createCollection> {
  return operations.createCollection(...args);
}

export async function updateCollection(
  ...args: Parameters<typeof operations.updateCollection>
): ReturnType<typeof operations.updateCollection> {
  return operations.updateCollection(...args);
}

export async function setCollectionActive(
  ...args: Parameters<typeof operations.setCollectionActive>
): ReturnType<typeof operations.setCollectionActive> {
  return operations.setCollectionActive(...args);
}

export async function bulkSetCollectionActive(
  ...args: Parameters<typeof operations.bulkSetCollectionActive>
): ReturnType<typeof operations.bulkSetCollectionActive> {
  return operations.bulkSetCollectionActive(...args);
}

export async function setCollectionSortOrder(
  ...args: Parameters<typeof operations.setCollectionSortOrder>
): ReturnType<typeof operations.setCollectionSortOrder> {
  return operations.setCollectionSortOrder(...args);
}

export async function importCollectionsFromCsv(
  ...args: Parameters<typeof operations.importCollectionsFromCsv>
): ReturnType<typeof operations.importCollectionsFromCsv> {
  return operations.importCollectionsFromCsv(...args);
}

export async function createDesign(
  ...args: Parameters<typeof operations.createDesign>
): ReturnType<typeof operations.createDesign> {
  return operations.createDesign(...args);
}

export async function updateDesign(
  ...args: Parameters<typeof operations.updateDesign>
): ReturnType<typeof operations.updateDesign> {
  return operations.updateDesign(...args);
}

export async function setDesignActive(
  ...args: Parameters<typeof operations.setDesignActive>
): ReturnType<typeof operations.setDesignActive> {
  return operations.setDesignActive(...args);
}

export async function bulkSetDesignActive(
  ...args: Parameters<typeof operations.bulkSetDesignActive>
): ReturnType<typeof operations.bulkSetDesignActive> {
  return operations.bulkSetDesignActive(...args);
}

export async function setDesignSortOrder(
  ...args: Parameters<typeof operations.setDesignSortOrder>
): ReturnType<typeof operations.setDesignSortOrder> {
  return operations.setDesignSortOrder(...args);
}

export async function duplicateDesign(
  ...args: Parameters<typeof operations.duplicateDesign>
): ReturnType<typeof operations.duplicateDesign> {
  return operations.duplicateDesign(...args);
}

export async function duplicateDesignAndGo(
  ...args: Parameters<typeof operations.duplicateDesignAndGo>
): ReturnType<typeof operations.duplicateDesignAndGo> {
  return operations.duplicateDesignAndGo(...args);
}

'use server';

/**
 * Server Action surface for `@/server/operations/admin-categories` — the thin half.
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

import * as operations from '@/server/operations/admin-categories';

export type { CategoryFormInput, CategoryMutationResult, CategoryCsvRowResult, ImportCategoriesResult } from '@/server/operations/admin-categories';

export async function createCategory(
  ...args: Parameters<typeof operations.createCategory>
): ReturnType<typeof operations.createCategory> {
  return operations.createCategory(...args);
}

export async function updateCategory(
  ...args: Parameters<typeof operations.updateCategory>
): ReturnType<typeof operations.updateCategory> {
  return operations.updateCategory(...args);
}

export async function setCategoryActive(
  ...args: Parameters<typeof operations.setCategoryActive>
): ReturnType<typeof operations.setCategoryActive> {
  return operations.setCategoryActive(...args);
}

export async function bulkSetCategoryActive(
  ...args: Parameters<typeof operations.bulkSetCategoryActive>
): ReturnType<typeof operations.bulkSetCategoryActive> {
  return operations.bulkSetCategoryActive(...args);
}

export async function setCategorySortOrder(
  ...args: Parameters<typeof operations.setCategorySortOrder>
): ReturnType<typeof operations.setCategorySortOrder> {
  return operations.setCategorySortOrder(...args);
}

export async function importCategoriesFromCsv(
  ...args: Parameters<typeof operations.importCategoriesFromCsv>
): ReturnType<typeof operations.importCategoriesFromCsv> {
  return operations.importCategoriesFromCsv(...args);
}

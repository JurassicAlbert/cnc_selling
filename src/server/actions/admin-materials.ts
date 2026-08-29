'use server';

/**
 * Server Action surface for `@/server/operations/admin-materials` — the thin half.
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

import * as operations from '@/server/operations/admin-materials';

export type { MaterialMutationResult } from '@/server/operations/admin-materials';

export async function createMaterial(
  ...args: Parameters<typeof operations.createMaterial>
): ReturnType<typeof operations.createMaterial> {
  return operations.createMaterial(...args);
}

export async function updateMaterial(
  ...args: Parameters<typeof operations.updateMaterial>
): ReturnType<typeof operations.updateMaterial> {
  return operations.updateMaterial(...args);
}

export async function setMaterialAvailable(
  ...args: Parameters<typeof operations.setMaterialAvailable>
): ReturnType<typeof operations.setMaterialAvailable> {
  return operations.setMaterialAvailable(...args);
}

export async function bulkSetMaterialAvailable(
  ...args: Parameters<typeof operations.bulkSetMaterialAvailable>
): ReturnType<typeof operations.bulkSetMaterialAvailable> {
  return operations.bulkSetMaterialAvailable(...args);
}

export async function setMaterialSortOrder(
  ...args: Parameters<typeof operations.setMaterialSortOrder>
): ReturnType<typeof operations.setMaterialSortOrder> {
  return operations.setMaterialSortOrder(...args);
}

export async function duplicateMaterial(
  ...args: Parameters<typeof operations.duplicateMaterial>
): ReturnType<typeof operations.duplicateMaterial> {
  return operations.duplicateMaterial(...args);
}

export async function duplicateMaterialAndGo(
  ...args: Parameters<typeof operations.duplicateMaterialAndGo>
): ReturnType<typeof operations.duplicateMaterialAndGo> {
  return operations.duplicateMaterialAndGo(...args);
}

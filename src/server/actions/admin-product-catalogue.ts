'use server';

/**
 * Server Action surface for `@/server/operations/admin-product-catalogue` - the thin half.
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

import * as operations from '@/server/operations/admin-product-catalogue';

export type { ActionResult, PresetSizeInput, ThicknessInput, InstallationVariantInput } from '@/server/operations/admin-product-catalogue';

export async function addPresetSize(
  ...args: Parameters<typeof operations.addPresetSize>
): ReturnType<typeof operations.addPresetSize> {
  return operations.addPresetSize(...args);
}

export async function removePresetSize(
  ...args: Parameters<typeof operations.removePresetSize>
): ReturnType<typeof operations.removePresetSize> {
  return operations.removePresetSize(...args);
}

export async function addThickness(
  ...args: Parameters<typeof operations.addThickness>
): ReturnType<typeof operations.addThickness> {
  return operations.addThickness(...args);
}

export async function removeThickness(
  ...args: Parameters<typeof operations.removeThickness>
): ReturnType<typeof operations.removeThickness> {
  return operations.removeThickness(...args);
}

export async function setProductMaterial(
  ...args: Parameters<typeof operations.setProductMaterial>
): ReturnType<typeof operations.setProductMaterial> {
  return operations.setProductMaterial(...args);
}

export async function removeProductMaterial(
  ...args: Parameters<typeof operations.removeProductMaterial>
): ReturnType<typeof operations.removeProductMaterial> {
  return operations.removeProductMaterial(...args);
}

export async function setProductDesign(
  ...args: Parameters<typeof operations.setProductDesign>
): ReturnType<typeof operations.setProductDesign> {
  return operations.setProductDesign(...args);
}

export async function removeProductDesign(
  ...args: Parameters<typeof operations.removeProductDesign>
): ReturnType<typeof operations.removeProductDesign> {
  return operations.removeProductDesign(...args);
}

export async function addInstallationVariant(
  ...args: Parameters<typeof operations.addInstallationVariant>
): ReturnType<typeof operations.addInstallationVariant> {
  return operations.addInstallationVariant(...args);
}

export async function removeInstallationVariant(
  ...args: Parameters<typeof operations.removeInstallationVariant>
): ReturnType<typeof operations.removeInstallationVariant> {
  return operations.removeInstallationVariant(...args);
}

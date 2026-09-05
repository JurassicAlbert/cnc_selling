/**
 * Nested product sub-resource editors - preset sizes, thicknesses,
 * material/design compatibility, installation variants. All of these are
 * genuinely deletable (not soft-delete-only): none is FK-referenced from
 * `Order`/`OrderItem` (orders hold an immutable JSON snapshot, never a
 * live join - `OrderItem.snapshot`'s own header). Each mutation still
 * gets its own audit row, entity `'Product'`, since they're all really
 * edits to one product's configuration.
 *
 * `applyXxx(staff, ...)` (pure, testable) / `xxx(...)` (real Server
 * Action) split, same as `admin-products.ts` - `revalidatePath` also
 * needs to stay in the wrapper: it fails the same way `next/headers` does
 * outside a real request (confirmed empirically building P7a).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { InstallationVariantCode } from '@/generated/prisma/enums';

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function revalidateProduct(productId: string): void {
  revalidatePath(`/panel/produkty/${productId}`);
}

// --- Preset sizes -----------------------------------------------------

export type PresetSizeInput = { readonly widthMm: number; readonly heightMm: number; readonly labelPl: string; readonly sortOrder: number };

export async function applyAddPresetSize(staff: CurrentSession, productId: string, input: PresetSizeInput): Promise<ActionResult> {
  if (input.widthMm <= 0 || input.heightMm <= 0) {
    return { ok: false, detail: 'Wymiary muszą być dodatnie.' };
  }
  await prisma.productPresetSize.create({ data: { productId, ...input } });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { addPresetSize: input } });
  return { ok: true };
}

export async function addPresetSize(productId: string, input: PresetSizeInput): Promise<ActionResult> {
  const staff = await requireAdminSession();
  const result = await applyAddPresetSize(staff, productId, input);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applyRemovePresetSize(staff: CurrentSession, productId: string, presetSizeId: string): Promise<void> {
  await prisma.productPresetSize.delete({ where: { id: presetSizeId } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removePresetSize: presetSizeId } });
}

export async function removePresetSize(productId: string, presetSizeId: string): Promise<void> {
  const staff = await requireAdminSession();
  await applyRemovePresetSize(staff, productId, presetSizeId);
  revalidateProduct(productId);
}

// --- Thicknesses --------------------------------------------------------

export type ThicknessInput = { readonly thicknessMm: number; readonly labelPl: string; readonly priceFactorBp: number; readonly sortOrder: number };

export async function applyAddThickness(staff: CurrentSession, productId: string, input: ThicknessInput): Promise<ActionResult> {
  if (input.thicknessMm <= 0) {
    return { ok: false, detail: 'Grubość musi być dodatnia.' };
  }
  await prisma.productThickness.create({ data: { productId, ...input } });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { addThickness: input } });
  return { ok: true };
}

export async function addThickness(productId: string, input: ThicknessInput): Promise<ActionResult> {
  const staff = await requireAdminSession();
  const result = await applyAddThickness(staff, productId, input);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applyRemoveThickness(staff: CurrentSession, productId: string, thicknessId: string): Promise<void> {
  await prisma.productThickness.delete({ where: { id: thicknessId } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removeThickness: thicknessId } });
}

export async function removeThickness(productId: string, thicknessId: string): Promise<void> {
  const staff = await requireAdminSession();
  await applyRemoveThickness(staff, productId, thicknessId);
  revalidateProduct(productId);
}

// --- Material compatibility ---------------------------------------------

export async function applySetProductMaterial(
  staff: CurrentSession,
  productId: string,
  materialId: string,
  priceFactorBp: number,
): Promise<ActionResult> {
  if (priceFactorBp <= 0) {
    return { ok: false, detail: 'Mnożnik ceny musi być dodatni.' };
  }
  await prisma.productMaterial.upsert({
    where: { productId_materialId: { productId, materialId } },
    create: { productId, materialId, priceFactorBp },
    update: { priceFactorBp },
  });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { setMaterial: { materialId, priceFactorBp } } });
  return { ok: true };
}

export async function setProductMaterial(productId: string, materialId: string, priceFactorBp: number): Promise<ActionResult> {
  const staff = await requireAdminSession();
  const result = await applySetProductMaterial(staff, productId, materialId, priceFactorBp);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applyRemoveProductMaterial(staff: CurrentSession, productId: string, materialId: string): Promise<void> {
  await prisma.productMaterial.delete({ where: { productId_materialId: { productId, materialId } } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removeMaterial: materialId } });
}

export async function removeProductMaterial(productId: string, materialId: string): Promise<void> {
  const staff = await requireAdminSession();
  await applyRemoveProductMaterial(staff, productId, materialId);
  revalidateProduct(productId);
}

// --- Design assignment ---------------------------------------------------

export async function applySetProductDesign(
  staff: CurrentSession,
  productId: string,
  designId: string,
  surchargeGrosze: number,
): Promise<ActionResult> {
  if (surchargeGrosze < 0) {
    return { ok: false, detail: 'Dopłata nie może być ujemna.' };
  }
  await prisma.productDesign.upsert({
    where: { productId_designId: { productId, designId } },
    create: { productId, designId, surchargeGrosze },
    update: { surchargeGrosze },
  });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { setDesign: { designId, surchargeGrosze } } });
  return { ok: true };
}

export async function setProductDesign(productId: string, designId: string, surchargeGrosze: number): Promise<ActionResult> {
  const staff = await requireAdminSession();
  const result = await applySetProductDesign(staff, productId, designId, surchargeGrosze);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applyRemoveProductDesign(staff: CurrentSession, productId: string, designId: string): Promise<void> {
  await prisma.productDesign.delete({ where: { productId_designId: { productId, designId } } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removeDesign: designId } });
}

export async function removeProductDesign(productId: string, designId: string): Promise<void> {
  const staff = await requireAdminSession();
  await applyRemoveProductDesign(staff, productId, designId);
  revalidateProduct(productId);
}

// --- Installation variants ------------------------------------------------

export type InstallationVariantInput = {
  readonly code: InstallationVariantCode;
  readonly namePl: string;
  readonly descPl: string;
  readonly receivesPl: string;
  readonly diagramUrl: string;
  readonly maxThicknessMm: number | null;
  readonly priceFactorBp: number;
  readonly sortOrder: number;
};

export async function applyAddInstallationVariant(
  staff: CurrentSession,
  productId: string,
  input: InstallationVariantInput,
): Promise<ActionResult> {
  if (input.namePl.trim().length === 0) {
    return { ok: false, detail: 'Nazwa jest wymagana.' };
  }
  await prisma.installationVariant.create({ data: { productId, ...input } });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { addInstallVariant: input } });
  return { ok: true };
}

export async function addInstallationVariant(productId: string, input: InstallationVariantInput): Promise<ActionResult> {
  const staff = await requireAdminSession();
  const result = await applyAddInstallationVariant(staff, productId, input);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applyRemoveInstallationVariant(staff: CurrentSession, productId: string, variantId: string): Promise<void> {
  await prisma.installationVariant.delete({ where: { id: variantId } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removeInstallVariant: variantId } });
}

export async function removeInstallationVariant(productId: string, variantId: string): Promise<void> {
  const staff = await requireAdminSession();
  await applyRemoveInstallationVariant(staff, productId, variantId);
  revalidateProduct(productId);
}

'use server';

/** Material↔finish compatibility — a plain toggle, no extra fields on `MaterialFinish` (unlike `ProductMaterial`'s `priceFactorBp`). Deletable freely, same reasoning as slice 1's `ProductMaterial`/`ProductDesign` editors. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function revalidateMaterial(materialId: string): void {
  revalidatePath(`/panel/materialy/${materialId}`);
}

export async function applyAddMaterialFinish(staff: CurrentSession, materialId: string, finishId: string): Promise<ActionResult> {
  await prisma.materialFinish.upsert({
    where: { materialId_finishId: { materialId, finishId } },
    create: { materialId, finishId },
    update: {},
  });
  await writeAuditLog({ actor: staff, entity: 'Material', entityId: materialId, action: 'update', diff: { addFinish: finishId } });
  return { ok: true };
}

export async function addMaterialFinish(materialId: string, finishId: string): Promise<ActionResult> {
  const staff = await requireStaffSession();
  const result = await applyAddMaterialFinish(staff, materialId, finishId);
  if (result.ok) {
    revalidateMaterial(materialId);
  }
  return result;
}

export async function applyRemoveMaterialFinish(staff: CurrentSession, materialId: string, finishId: string): Promise<void> {
  await prisma.materialFinish.delete({ where: { materialId_finishId: { materialId, finishId } } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Material', entityId: materialId, action: 'update', diff: { removeFinish: finishId } });
}

export async function removeMaterialFinish(materialId: string, finishId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applyRemoveMaterialFinish(staff, materialId, finishId);
  revalidateMaterial(materialId);
}

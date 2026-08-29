/** Design↔material compatibility — a plain toggle, no extra fields on `DesignMaterial` (same shape as slice 2's `admin-material-finishes.ts`). Schema's own comment: "no rows means every material the product allows." */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function revalidateDesign(designId: string): void {
  revalidatePath(`/panel/wzory/${designId}`);
}

export async function applyAddDesignMaterial(staff: CurrentSession, designId: string, materialId: string): Promise<ActionResult> {
  await prisma.designMaterial.upsert({
    where: { designId_materialId: { designId, materialId } },
    create: { designId, materialId },
    update: {},
  });
  await writeAuditLog({ actor: staff, entity: 'Design', entityId: designId, action: 'update', diff: { addMaterial: materialId } });
  return { ok: true };
}

export async function addDesignMaterial(designId: string, materialId: string): Promise<ActionResult> {
  const staff = await requireStaffSession();
  const result = await applyAddDesignMaterial(staff, designId, materialId);
  if (result.ok) {
    revalidateDesign(designId);
  }
  return result;
}

export async function applyRemoveDesignMaterial(staff: CurrentSession, designId: string, materialId: string): Promise<void> {
  await prisma.designMaterial.delete({ where: { designId_materialId: { designId, materialId } } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'Design', entityId: designId, action: 'update', diff: { removeMaterial: materialId } });
}

export async function removeDesignMaterial(designId: string, materialId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applyRemoveDesignMaterial(staff, designId, materialId);
  revalidateDesign(designId);
}

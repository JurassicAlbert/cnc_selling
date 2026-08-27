'use server';

/**
 * Staff material mutations. `Material.imageUrl` is required (`String`, not
 * `String?`, unlike `Category.imageUrl`) — so unlike `admin-categories.ts`,
 * create/update take a `FormData` (multipart, carries the photo) rather
 * than a plain typed object, and a create can't succeed without a real
 * uploaded image. Same `applyXxx(staff, ...)` / `xxx(...)` split as every
 * other admin action file — `revalidatePath` stays in the wrapper only.
 *
 * No delete action — `Material` is a real FK target, and unlike
 * `Order`/`OrderItem`'s snapshot-only pattern, `Configuration.materialId`
 * is a LIVE FK from in-progress carts. §16A.2: `isAvailable` toggle only.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { savePublicImage } from '@/server/storage/public-images';
import type { GrainDirection, MaterialFamily } from '@/generated/prisma/enums';

export type MaterialMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type MaterialFields = {
  readonly slug: string;
  readonly namePl: string;
  readonly family: MaterialFamily;
  readonly shortDescPl: string;
  readonly characteristicsPl: string;
  readonly pricePerM2Grosze: number;
  readonly maxSheetWidthMm: number;
  readonly maxSheetHeightMm: number;
  readonly minLineWidthUm: number;
  readonly minDetailSpacingUm: number;
  readonly minTextHeightUm: number;
  readonly grainDirection: GrainDirection;
  readonly supportsCnc: boolean;
  readonly supportsLaser: boolean;
  readonly isNaturalVariable: boolean;
  readonly sortOrder: number;
};

function readMaterialFields(formData: FormData): MaterialFields {
  return {
    slug: String(formData.get('slug') ?? ''),
    namePl: String(formData.get('namePl') ?? ''),
    family: String(formData.get('family') ?? '') as MaterialFamily,
    shortDescPl: String(formData.get('shortDescPl') ?? ''),
    characteristicsPl: String(formData.get('characteristicsPl') ?? ''),
    pricePerM2Grosze: Math.round(Number(formData.get('pricePerM2Pln') ?? 0) * 100),
    maxSheetWidthMm: Number(formData.get('maxSheetWidthMm') ?? 0),
    maxSheetHeightMm: Number(formData.get('maxSheetHeightMm') ?? 0),
    minLineWidthUm: Number(formData.get('minLineWidthUm') ?? 0),
    minDetailSpacingUm: Number(formData.get('minDetailSpacingUm') ?? 0),
    minTextHeightUm: Number(formData.get('minTextHeightUm') ?? 0),
    grainDirection: String(formData.get('grainDirection') ?? 'NONE') as GrainDirection,
    supportsCnc: formData.get('supportsCnc') === 'on',
    supportsLaser: formData.get('supportsLaser') === 'on',
    isNaturalVariable: formData.get('isNaturalVariable') === 'on',
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  };
}

function validateMaterialFields(fields: MaterialFields): string | null {
  if (!SLUG_PATTERN.test(fields.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (fields.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (fields.pricePerM2Grosze <= 0) {
    return 'Cena za m² musi być dodatnia.';
  }
  return null;
}

export async function applyCreateMaterial(staff: CurrentSession, formData: FormData): Promise<MaterialMutationResult> {
  const fields = readMaterialFields(formData);
  const issue = validateMaterialFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const existing = await prisma.material.findUnique({ where: { slug: fields.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Materiał z tym identyfikatorem URL już istnieje.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detail: 'Zdjęcie jest wymagane.' };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await savePublicImage('materials', fields.slug, bytes);
  if (!saved.ok) {
    return { ok: false, detail: saved.detail };
  }

  const material = await prisma.material.create({ data: { ...fields, imageUrl: saved.url } });
  await writeAuditLog({ actor: staff, entity: 'Material', entityId: material.id, action: 'create', diff: fields });

  return { ok: true, id: material.id };
}

export async function createMaterial(formData: FormData): Promise<MaterialMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateMaterial(staff, formData);
  if (result.ok) {
    revalidatePath('/panel/materialy');
  }
  return result;
}

export async function applyUpdateMaterial(
  staff: CurrentSession,
  id: string,
  formData: FormData,
): Promise<MaterialMutationResult> {
  const fields = readMaterialFields(formData);
  const issue = validateMaterialFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const current = await prisma.material.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Materiał nie istnieje.' };
  }
  if (current.slug !== fields.slug) {
    const clashing = await prisma.material.findUnique({ where: { slug: fields.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Materiał z tym identyfikatorem URL już istnieje.' };
    }
  }

  let imageUrl = current.imageUrl;
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await savePublicImage('materials', fields.slug, bytes);
    if (!saved.ok) {
      return { ok: false, detail: saved.detail };
    }
    imageUrl = saved.url;
  }

  await prisma.material.update({ where: { id }, data: { ...fields, imageUrl } });
  await writeAuditLog({ actor: staff, entity: 'Material', entityId: id, action: 'update', diff: { before: current, after: fields } });

  return { ok: true, id };
}

export async function updateMaterial(id: string, formData: FormData): Promise<MaterialMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateMaterial(staff, id, formData);
  if (result.ok) {
    revalidatePath('/panel/materialy');
    revalidatePath(`/panel/materialy/${id}`);
  }
  return result;
}

export async function applySetMaterialAvailable(staff: CurrentSession, id: string, isAvailable: boolean): Promise<void> {
  const current = await prisma.material.findUnique({ where: { id }, select: { isAvailable: true } });
  if (current === null) {
    return;
  }
  await prisma.material.update({ where: { id }, data: { isAvailable } });
  await writeAuditLog({
    actor: staff,
    entity: 'Material',
    entityId: id,
    action: 'update',
    diff: { isAvailable: { from: current.isAvailable, to: isAvailable } },
  });
}

export async function setMaterialAvailable(id: string, isAvailable: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetMaterialAvailable(staff, id, isAvailable);
  revalidatePath('/panel/materialy');
  revalidatePath(`/panel/materialy/${id}`);
}

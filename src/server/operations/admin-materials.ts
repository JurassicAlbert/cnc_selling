/**
 * Staff material mutations. `Material.imageUrl` is required (`String`, not
 * `String?`, unlike `Category.imageUrl`) - so unlike `admin-categories.ts`,
 * create/update take a `FormData` (multipart, carries the photo) rather
 * than a plain typed object, and a create can't succeed without a real
 * uploaded image. Same `applyXxx(staff, ...)` / `xxx(...)` split as every
 * other admin action file - `revalidatePath` stays in the wrapper only.
 *
 * No delete action - `Material` is a real FK target, and unlike
 * `Order`/`OrderItem`'s snapshot-only pattern, `Configuration.materialId`
 * is a LIVE FK from in-progress carts. §16A.2: `isAvailable` toggle only.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { savePublicImage } from '@/server/storage/public-images';
import { nextAvailableSlug } from '@/server/util/unique-slug';
import { refreshStartingPricesAfterCatalogueChange } from '@/server/pricing/starting-price';
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
  /** Real, used to compute a configuration's real shipping weight (`domain/shipping/weight.ts`) - never a fabricated per-product weight. */
  readonly densityKgPerM3: number;
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
    densityKgPerM3: Number(formData.get('densityKgPerM3') ?? 0),
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
    return `Cena za m² musi być dodatnia - podano ${(fields.pricePerM2Grosze / 100).toFixed(2)} zł.`;
  }
  if (!Number.isFinite(fields.densityKgPerM3) || fields.densityKgPerM3 <= 0) {
    return 'Gęstość (kg/m³) musi być dodatnia - potrzebna do wyliczenia realnej wagi przesyłki.';
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
  // `pricePerM2Grosze` feeds the advertised "od X zł" on every card this
  // material appears on (`docs/REVIEW-DETAILED.md` BUG-02).
  await refreshStartingPricesAfterCatalogueChange();

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
  // Withdrawing a material can remove the very configuration a product's
  // advertised price was derived from.
  await refreshStartingPricesAfterCatalogueChange();
}

export async function setMaterialAvailable(id: string, isAvailable: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetMaterialAvailable(staff, id, isAvailable);
  revalidatePath('/panel/materialy');
  revalidatePath(`/panel/materialy/${id}`);
}

/** Bulk activate/deactivate from the grid's selection toolbar (P7c) - see `admin-categories.ts`'s `bulkSetCategoryActive` for the pattern. */
export async function applyBulkSetMaterialAvailable(staff: CurrentSession, ids: readonly string[], isAvailable: boolean): Promise<void> {
  for (const id of ids) {
    await applySetMaterialAvailable(staff, id, isAvailable);
  }
}

export async function bulkSetMaterialAvailable(ids: readonly string[], isAvailable: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applyBulkSetMaterialAvailable(staff, ids, isAvailable);
  revalidatePath('/panel/materialy');
}

export async function applySetMaterialSortOrder(staff: CurrentSession, id: string, sortOrder: number): Promise<void> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return;
  }
  const current = await prisma.material.findUnique({ where: { id }, select: { sortOrder: true } });
  if (current === null) {
    return;
  }
  await prisma.material.update({ where: { id }, data: { sortOrder } });
  await writeAuditLog({
    actor: staff,
    entity: 'Material',
    entityId: id,
    action: 'update',
    diff: { sortOrder: { from: current.sortOrder, to: sortOrder } },
  });
}

export async function setMaterialSortOrder(id: string, sortOrder: number): Promise<void> {
  const staff = await requireStaffSession();
  await applySetMaterialSortOrder(staff, id, sortOrder);
  revalidatePath('/panel/materialy');
  revalidatePath(`/panel/materialy/${id}`);
}

/**
 * Copies the core scalar record plus the existing `imageUrl` (the file
 * is reused, not re-uploaded - same "starts pointing at the same image
 * until replaced" rule as `applyDuplicateDesign`), but not compatible-
 * finish rows, which are frequently material-specific. Starts
 * unavailable, same "review before it goes live" rule as every other
 * duplicate action.
 */
export async function applyDuplicateMaterial(staff: CurrentSession, id: string): Promise<MaterialMutationResult> {
  const original = await prisma.material.findUnique({ where: { id } });
  if (original === null) {
    return { ok: false, detail: 'Materiał nie istnieje.' };
  }

  const slug = await nextAvailableSlug(
    original.slug,
    async (candidate) => (await prisma.material.findUnique({ where: { slug: candidate }, select: { id: true } })) !== null,
  );

  const fields: MaterialFields = {
    slug,
    namePl: `${original.namePl} (kopia)`,
    family: original.family,
    shortDescPl: original.shortDescPl,
    characteristicsPl: original.characteristicsPl,
    pricePerM2Grosze: original.pricePerM2Grosze,
    densityKgPerM3: original.densityKgPerM3,
    maxSheetWidthMm: original.maxSheetWidthMm,
    maxSheetHeightMm: original.maxSheetHeightMm,
    minLineWidthUm: original.minLineWidthUm,
    minDetailSpacingUm: original.minDetailSpacingUm,
    minTextHeightUm: original.minTextHeightUm,
    grainDirection: original.grainDirection,
    supportsCnc: original.supportsCnc,
    supportsLaser: original.supportsLaser,
    isNaturalVariable: original.isNaturalVariable,
    sortOrder: original.sortOrder,
  };

  const created = await prisma.material.create({ data: { ...fields, imageUrl: original.imageUrl, isAvailable: false } });
  await writeAuditLog({
    actor: staff,
    entity: 'Material',
    entityId: created.id,
    action: 'create',
    diff: { ...fields, duplicatedFromId: id },
  });

  return { ok: true, id: created.id };
}

export async function duplicateMaterial(id: string): Promise<MaterialMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyDuplicateMaterial(staff, id);
  if (result.ok) {
    revalidatePath('/panel/materialy');
  }
  return result;
}

/** See `duplicateProductAndGo`'s own comment - same zero-JS-button shape. */
export async function duplicateMaterialAndGo(id: string): Promise<void> {
  const result = await duplicateMaterial(id);
  if (result.ok) {
    redirect(`/panel/materialy/${result.id}`);
  }
}

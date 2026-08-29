/** Staff finish mutations. Same shape as `admin-materials.ts` — `Finish.imageUrl` is also required, so create/update take `FormData`. No delete — `Finish` is a real FK target (`MaterialFinish`, live `Configuration.finishId`); `isAvailable` toggle only. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { savePublicImage } from '@/server/storage/public-images';
import type { FinishKind } from '@/generated/prisma/enums';

export type FinishMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type FinishFields = {
  readonly slug: string;
  readonly namePl: string;
  readonly kind: FinishKind;
  readonly descPl: string;
  readonly pricePerM2Grosze: number;
  readonly setupFeeGrosze: number;
  readonly extraDaysMin: number;
  readonly extraDaysMax: number;
  readonly sortOrder: number;
};

function readFinishFields(formData: FormData): FinishFields {
  return {
    slug: String(formData.get('slug') ?? ''),
    namePl: String(formData.get('namePl') ?? ''),
    kind: String(formData.get('kind') ?? '') as FinishKind,
    descPl: String(formData.get('descPl') ?? ''),
    pricePerM2Grosze: Math.round(Number(formData.get('pricePerM2Pln') ?? 0) * 100),
    setupFeeGrosze: Math.round(Number(formData.get('setupFeePln') ?? 0) * 100),
    extraDaysMin: Number(formData.get('extraDaysMin') ?? 0),
    extraDaysMax: Number(formData.get('extraDaysMax') ?? 0),
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  };
}

function validateFinishFields(fields: FinishFields): string | null {
  if (!SLUG_PATTERN.test(fields.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (fields.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (fields.extraDaysMin > fields.extraDaysMax) {
    return `Minimalny dodatkowy czas (${fields.extraDaysMin} dni) nie może być dłuższy od maksymalnego (${fields.extraDaysMax} dni).`;
  }
  return null;
}

export async function applyCreateFinish(staff: CurrentSession, formData: FormData): Promise<FinishMutationResult> {
  const fields = readFinishFields(formData);
  const issue = validateFinishFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const existing = await prisma.finish.findUnique({ where: { slug: fields.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Wykończenie z tym identyfikatorem URL już istnieje.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detail: 'Zdjęcie jest wymagane.' };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await savePublicImage('finishes', fields.slug, bytes);
  if (!saved.ok) {
    return { ok: false, detail: saved.detail };
  }

  const finish = await prisma.finish.create({ data: { ...fields, imageUrl: saved.url } });
  await writeAuditLog({ actor: staff, entity: 'Finish', entityId: finish.id, action: 'create', diff: fields });

  return { ok: true, id: finish.id };
}

export async function createFinish(formData: FormData): Promise<FinishMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateFinish(staff, formData);
  if (result.ok) {
    revalidatePath('/panel/wykonczenia');
  }
  return result;
}

export async function applyUpdateFinish(staff: CurrentSession, id: string, formData: FormData): Promise<FinishMutationResult> {
  const fields = readFinishFields(formData);
  const issue = validateFinishFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const current = await prisma.finish.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Wykończenie nie istnieje.' };
  }
  if (current.slug !== fields.slug) {
    const clashing = await prisma.finish.findUnique({ where: { slug: fields.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Wykończenie z tym identyfikatorem URL już istnieje.' };
    }
  }

  let imageUrl = current.imageUrl;
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await savePublicImage('finishes', fields.slug, bytes);
    if (!saved.ok) {
      return { ok: false, detail: saved.detail };
    }
    imageUrl = saved.url;
  }

  await prisma.finish.update({ where: { id }, data: { ...fields, imageUrl } });
  await writeAuditLog({ actor: staff, entity: 'Finish', entityId: id, action: 'update', diff: { before: current, after: fields } });

  return { ok: true, id };
}

export async function updateFinish(id: string, formData: FormData): Promise<FinishMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateFinish(staff, id, formData);
  if (result.ok) {
    revalidatePath('/panel/wykonczenia');
    revalidatePath(`/panel/wykonczenia/${id}`);
  }
  return result;
}

export async function applySetFinishAvailable(staff: CurrentSession, id: string, isAvailable: boolean): Promise<void> {
  const current = await prisma.finish.findUnique({ where: { id }, select: { isAvailable: true } });
  if (current === null) {
    return;
  }
  await prisma.finish.update({ where: { id }, data: { isAvailable } });
  await writeAuditLog({
    actor: staff,
    entity: 'Finish',
    entityId: id,
    action: 'update',
    diff: { isAvailable: { from: current.isAvailable, to: isAvailable } },
  });
}

export async function applySetFinishSortOrder(staff: CurrentSession, id: string, sortOrder: number): Promise<void> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return;
  }
  const current = await prisma.finish.findUnique({ where: { id }, select: { sortOrder: true } });
  if (current === null) {
    return;
  }
  await prisma.finish.update({ where: { id }, data: { sortOrder } });
  await writeAuditLog({
    actor: staff,
    entity: 'Finish',
    entityId: id,
    action: 'update',
    diff: { sortOrder: { from: current.sortOrder, to: sortOrder } },
  });
}

export async function setFinishSortOrder(id: string, sortOrder: number): Promise<void> {
  const staff = await requireStaffSession();
  await applySetFinishSortOrder(staff, id, sortOrder);
  revalidatePath('/panel/wykonczenia');
  revalidatePath(`/panel/wykonczenia/${id}`);
}

export async function setFinishAvailable(id: string, isAvailable: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetFinishAvailable(staff, id, isAvailable);
  revalidatePath('/panel/wykonczenia');
  revalidatePath(`/panel/wykonczenia/${id}`);
}

/** Bulk activate/deactivate from the grid's selection toolbar (P7c) — see `admin-categories.ts`'s `bulkSetCategoryActive` for the pattern. */
export async function applyBulkSetFinishAvailable(staff: CurrentSession, ids: readonly string[], isAvailable: boolean): Promise<void> {
  for (const id of ids) {
    await applySetFinishAvailable(staff, id, isAvailable);
  }
}

export async function bulkSetFinishAvailable(ids: readonly string[], isAvailable: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applyBulkSetFinishAvailable(staff, ids, isAvailable);
  revalidatePath('/panel/wykonczenia');
}

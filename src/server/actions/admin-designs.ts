'use server';

/**
 * Staff design/collection mutations. `Design.thumbnailUrl`/`previewUrl`
 * are both required and distinct (not one image reused) — like
 * `admin-materials.ts`, create/update take `FormData` directly. Same
 * `applyXxx(staff, ...)` / `xxx(...)` split as every other admin action
 * file — `revalidatePath` only in the wrapper.
 *
 * No delete action for either entity — `Design` cascades its
 * `ProductDesign` assignments and orphans live `Configuration` rows on
 * delete (confirmed via the actual migration SQL, not assumed);
 * `DesignCollection` is technically SET NULL-safe but kept to the same
 * `isActive`-toggle-only rule as every other catalogue entity for
 * consistency (§16A.2).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { savePublicImage } from '@/server/storage/public-images';
import type { DesignRightsStatus, ProductionMethod } from '@/generated/prisma/enums';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// --- Collections ----------------------------------------------------------

export type CollectionFormInput = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly sortOrder: number;
};

export type CollectionMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

function validateCollectionInput(input: CollectionFormInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  return null;
}

export async function applyCreateCollection(staff: CurrentSession, input: CollectionFormInput): Promise<CollectionMutationResult> {
  const issue = validateCollectionInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const existing = await prisma.designCollection.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Kolekcja z tym identyfikatorem URL już istnieje.' };
  }

  const collection = await prisma.designCollection.create({ data: input });
  await writeAuditLog({ actor: staff, entity: 'DesignCollection', entityId: collection.id, action: 'create', diff: input });
  return { ok: true, id: collection.id };
}

export async function createCollection(input: CollectionFormInput): Promise<CollectionMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateCollection(staff, input);
  if (result.ok) {
    revalidatePath('/panel/kolekcje');
  }
  return result;
}

export async function applyUpdateCollection(
  staff: CurrentSession,
  id: string,
  input: CollectionFormInput,
): Promise<CollectionMutationResult> {
  const issue = validateCollectionInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.designCollection.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Kolekcja nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.designCollection.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Kolekcja z tym identyfikatorem URL już istnieje.' };
    }
  }

  await prisma.designCollection.update({ where: { id }, data: input });
  await writeAuditLog({ actor: staff, entity: 'DesignCollection', entityId: id, action: 'update', diff: { before: current, after: input } });
  return { ok: true, id };
}

export async function updateCollection(id: string, input: CollectionFormInput): Promise<CollectionMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateCollection(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/kolekcje');
    revalidatePath(`/panel/kolekcje/${id}`);
  }
  return result;
}

export async function applySetCollectionActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.designCollection.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.designCollection.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'DesignCollection',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setCollectionActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetCollectionActive(staff, id, isActive);
  revalidatePath('/panel/kolekcje');
  revalidatePath(`/panel/kolekcje/${id}`);
}

// --- Designs ------------------------------------------------------------

export type DesignMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

type DesignFields = {
  readonly slug: string;
  readonly code: string;
  readonly namePl: string;
  readonly descPl: string | null;
  readonly collectionId: string | null;
  readonly tags: string[];
  readonly referenceWidthMm: number;
  readonly minLineWidthUm: number;
  readonly minDetailSpacingUm: number;
  readonly minEngraveDepthUm: number | null;
  readonly recommendedMethod: ProductionMethod;
  readonly minRecommendedWidthMm: number;
  readonly maxRecommendedWidthMm: number | null;
  readonly detailLevel: number;
  readonly machiningMilliMinutesPerM2: number;
  readonly rightsStatus: DesignRightsStatus;
  readonly sourceArtist: string | null;
  readonly sourceTitle: string | null;
  readonly sourceYear: number | null;
  readonly artistDeathYear: number | null;
  readonly sourceRef: string | null;
  readonly rightsNotes: string | null;
  readonly sortOrder: number;
};

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim();
  return raw.length > 0 ? Number(raw) : null;
}

function readDesignFields(formData: FormData): DesignFields {
  const tagsRaw = String(formData.get('tags') ?? '');
  return {
    slug: String(formData.get('slug') ?? ''),
    code: String(formData.get('code') ?? ''),
    namePl: String(formData.get('namePl') ?? ''),
    descPl: optionalText(formData, 'descPl'),
    collectionId: optionalText(formData, 'collectionId'),
    tags: tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    referenceWidthMm: Number(formData.get('referenceWidthMm') ?? 0),
    minLineWidthUm: Number(formData.get('minLineWidthUm') ?? 0),
    minDetailSpacingUm: Number(formData.get('minDetailSpacingUm') ?? 0),
    // `REQUIRES_PERMISSION` (the Prisma column default) unless the form
    // explicitly submits something else — §12: never silently sellable.
    minEngraveDepthUm: optionalNumber(formData, 'minEngraveDepthUm'),
    recommendedMethod: String(formData.get('recommendedMethod') ?? 'CNC_ENGRAVE') as ProductionMethod,
    minRecommendedWidthMm: Number(formData.get('minRecommendedWidthMm') ?? 0),
    maxRecommendedWidthMm: optionalNumber(formData, 'maxRecommendedWidthMm'),
    detailLevel: Number(formData.get('detailLevel') ?? 1),
    machiningMilliMinutesPerM2: Number(formData.get('machiningMilliMinutesPerM2') ?? 0),
    rightsStatus: String(formData.get('rightsStatus') ?? 'REQUIRES_PERMISSION') as DesignRightsStatus,
    sourceArtist: optionalText(formData, 'sourceArtist'),
    sourceTitle: optionalText(formData, 'sourceTitle'),
    sourceYear: optionalNumber(formData, 'sourceYear'),
    artistDeathYear: optionalNumber(formData, 'artistDeathYear'),
    sourceRef: optionalText(formData, 'sourceRef'),
    rightsNotes: optionalText(formData, 'rightsNotes'),
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  };
}

function validateDesignFields(fields: DesignFields): string | null {
  if (!SLUG_PATTERN.test(fields.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (fields.code.trim().length === 0) {
    return 'Kod jest wymagany.';
  }
  if (fields.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (fields.detailLevel < 1 || fields.detailLevel > 5) {
    return 'Poziom szczegółowości musi być liczbą od 1 do 5.';
  }
  return null;
}

export async function applyCreateDesign(staff: CurrentSession, formData: FormData): Promise<DesignMutationResult> {
  const fields = readDesignFields(formData);
  const issue = validateDesignFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const existingSlug = await prisma.design.findUnique({ where: { slug: fields.slug }, select: { id: true } });
  if (existingSlug !== null) {
    return { ok: false, detail: 'Wzór z tym identyfikatorem URL już istnieje.' };
  }
  const existingCode = await prisma.design.findUnique({ where: { code: fields.code }, select: { id: true } });
  if (existingCode !== null) {
    return { ok: false, detail: 'Wzór z tym kodem już istnieje.' };
  }

  const thumbnailFile = formData.get('thumbnailFile');
  const previewFile = formData.get('previewFile');
  if (!(thumbnailFile instanceof File) || thumbnailFile.size === 0) {
    return { ok: false, detail: 'Miniatura jest wymagana.' };
  }
  if (!(previewFile instanceof File) || previewFile.size === 0) {
    return { ok: false, detail: 'Obraz podglądu jest wymagany.' };
  }

  const savedThumbnail = await savePublicImage('designs', fields.slug, Buffer.from(await thumbnailFile.arrayBuffer()));
  if (!savedThumbnail.ok) {
    return { ok: false, detail: savedThumbnail.detail };
  }
  const savedPreview = await savePublicImage('designs', fields.slug, Buffer.from(await previewFile.arrayBuffer()));
  if (!savedPreview.ok) {
    return { ok: false, detail: savedPreview.detail };
  }

  const design = await prisma.design.create({
    data: { ...fields, thumbnailUrl: savedThumbnail.url, previewUrl: savedPreview.url },
  });
  await writeAuditLog({ actor: staff, entity: 'Design', entityId: design.id, action: 'create', diff: fields });

  return { ok: true, id: design.id };
}

export async function createDesign(formData: FormData): Promise<DesignMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateDesign(staff, formData);
  if (result.ok) {
    revalidatePath('/panel/wzory');
  }
  return result;
}

export async function applyUpdateDesign(staff: CurrentSession, id: string, formData: FormData): Promise<DesignMutationResult> {
  const fields = readDesignFields(formData);
  const issue = validateDesignFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const current = await prisma.design.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Wzór nie istnieje.' };
  }
  if (current.slug !== fields.slug) {
    const clashing = await prisma.design.findUnique({ where: { slug: fields.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Wzór z tym identyfikatorem URL już istnieje.' };
    }
  }
  if (current.code !== fields.code) {
    const clashing = await prisma.design.findUnique({ where: { code: fields.code }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Wzór z tym kodem już istnieje.' };
    }
  }

  let thumbnailUrl = current.thumbnailUrl;
  const thumbnailFile = formData.get('thumbnailFile');
  if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
    const saved = await savePublicImage('designs', fields.slug, Buffer.from(await thumbnailFile.arrayBuffer()));
    if (!saved.ok) {
      return { ok: false, detail: saved.detail };
    }
    thumbnailUrl = saved.url;
  }

  let previewUrl = current.previewUrl;
  const previewFile = formData.get('previewFile');
  if (previewFile instanceof File && previewFile.size > 0) {
    const saved = await savePublicImage('designs', fields.slug, Buffer.from(await previewFile.arrayBuffer()));
    if (!saved.ok) {
      return { ok: false, detail: saved.detail };
    }
    previewUrl = saved.url;
  }

  await prisma.design.update({ where: { id }, data: { ...fields, thumbnailUrl, previewUrl } });
  await writeAuditLog({ actor: staff, entity: 'Design', entityId: id, action: 'update', diff: { before: current, after: fields } });

  return { ok: true, id };
}

export async function updateDesign(id: string, formData: FormData): Promise<DesignMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateDesign(staff, id, formData);
  if (result.ok) {
    revalidatePath('/panel/wzory');
    revalidatePath(`/panel/wzory/${id}`);
  }
  return result;
}

export async function applySetDesignActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.design.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.design.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'Design',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setDesignActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetDesignActive(staff, id, isActive);
  revalidatePath('/panel/wzory');
  revalidatePath(`/panel/wzory/${id}`);
}

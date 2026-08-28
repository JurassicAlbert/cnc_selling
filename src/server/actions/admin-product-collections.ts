'use server';

/**
 * Staff `ProductCollection` mutations — same `applyXxx(staff, ...)` /
 * `xxx(...)` split as every other admin action file. Deliberately a
 * separate file/model from `DesignCollection`'s collection actions in
 * `admin-designs.ts` (P9 phase 4) — do not merge them, they mean different
 * things (a grouping of sellable products vs. a grouping of patterns).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ProductCollectionFormInput = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly imageUrl: string;
  readonly sortOrder: number;
};

export type ProductCollectionMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

function validateProductCollectionInput(input: ProductCollectionFormInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (input.descPl.trim().length === 0) {
    return 'Opis jest wymagany.';
  }
  return null;
}

export async function applyCreateProductCollection(staff: CurrentSession, input: ProductCollectionFormInput): Promise<ProductCollectionMutationResult> {
  const issue = validateProductCollectionInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const clashing = await prisma.productCollection.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (clashing !== null) {
    return { ok: false, detail: 'Kolekcja z tym identyfikatorem URL już istnieje.' };
  }
  const data = { slug: input.slug, namePl: input.namePl, descPl: input.descPl, imageUrl: input.imageUrl.trim().length > 0 ? input.imageUrl : null, sortOrder: input.sortOrder };
  const collection = await prisma.productCollection.create({ data });
  await writeAuditLog({ actor: staff, entity: 'ProductCollection', entityId: collection.id, action: 'create', diff: data });
  return { ok: true, id: collection.id };
}

export async function createProductCollection(input: ProductCollectionFormInput): Promise<ProductCollectionMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateProductCollection(staff, input);
  if (result.ok) {
    revalidatePath('/panel/kolekcje-produktow');
    revalidatePath('/kolekcje');
  }
  return result;
}

export async function applyUpdateProductCollection(
  staff: CurrentSession,
  id: string,
  input: ProductCollectionFormInput,
): Promise<ProductCollectionMutationResult> {
  const issue = validateProductCollectionInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.productCollection.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Kolekcja nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.productCollection.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Kolekcja z tym identyfikatorem URL już istnieje.' };
    }
  }
  const data = { slug: input.slug, namePl: input.namePl, descPl: input.descPl, imageUrl: input.imageUrl.trim().length > 0 ? input.imageUrl : null, sortOrder: input.sortOrder };
  await prisma.productCollection.update({ where: { id }, data });
  await writeAuditLog({ actor: staff, entity: 'ProductCollection', entityId: id, action: 'update', diff: { before: current, after: data } });
  return { ok: true, id };
}

export async function updateProductCollection(id: string, input: ProductCollectionFormInput): Promise<ProductCollectionMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateProductCollection(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/kolekcje-produktow');
    revalidatePath('/kolekcje');
  }
  return result;
}

export async function applySetProductCollectionActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.productCollection.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.productCollection.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'ProductCollection',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setProductCollectionActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetProductCollectionActive(staff, id, isActive);
  revalidatePath('/panel/kolekcje-produktow');
  revalidatePath('/kolekcje');
}

// --- Product assignment ----------------------------------------------------

export type ProductCollectionItemResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applySetProductCollectionItem(
  staff: CurrentSession,
  collectionId: string,
  productId: string,
  sortOrder: number,
): Promise<ProductCollectionItemResult> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { ok: false, detail: 'Kolejność musi być nieujemną liczbą całkowitą.' };
  }
  await prisma.productCollectionItem.upsert({
    where: { collectionId_productId: { collectionId, productId } },
    create: { collectionId, productId, sortOrder },
    update: { sortOrder },
  });
  await writeAuditLog({
    actor: staff,
    entity: 'ProductCollection',
    entityId: collectionId,
    action: 'update',
    diff: { addProduct: { productId, sortOrder } },
  });
  return { ok: true };
}

export async function setProductCollectionItem(collectionId: string, productId: string, sortOrder: number): Promise<ProductCollectionItemResult> {
  const staff = await requireStaffSession();
  const result = await applySetProductCollectionItem(staff, collectionId, productId, sortOrder);
  if (result.ok) {
    revalidatePath(`/panel/kolekcje-produktow/${collectionId}`);
    revalidatePath('/kolekcje');
  }
  return result;
}

export async function applyRemoveProductCollectionItem(staff: CurrentSession, collectionId: string, productId: string): Promise<void> {
  await prisma.productCollectionItem.delete({ where: { collectionId_productId: { collectionId, productId } } }).catch(() => undefined);
  await writeAuditLog({ actor: staff, entity: 'ProductCollection', entityId: collectionId, action: 'update', diff: { removeProduct: productId } });
}

export async function removeProductCollectionItem(collectionId: string, productId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applyRemoveProductCollectionItem(staff, collectionId, productId);
  revalidatePath(`/panel/kolekcje-produktow/${collectionId}`);
  revalidatePath('/kolekcje');
}

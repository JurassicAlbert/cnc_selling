'use server';

/**
 * Staff product mutations — core record only. Nested sub-resources
 * (preset sizes, thicknesses, material/design compatibility, installation
 * variants, images) live in `admin-product-catalogue.ts`/
 * `admin-product-images.ts`. Same `applyXxx(staff, ...)`/`xxx(...)` split
 * as `admin-categories.ts`.
 *
 * No delete action — `Product` is a real FK target (`Configuration.
 * productId`, `ProductImage.productId`, etc.); §16A.2's soft-delete
 * invariant means `setProductActive` is the only way to retire one.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { ProductTypeCode } from '@/generated/prisma/enums';

export type ProductCoreInput = {
  readonly slug: string;
  readonly typeCode: ProductTypeCode;
  readonly categoryId: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  readonly longDescPl: string;
  readonly careInstructionsPl: string;
  readonly installationInfoPl: string | null;
  readonly materialNotesPl: string | null;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly basePriceGrosze: number;
  readonly minPriceGrosze: number;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
  readonly allowsCustomSize: boolean;
  readonly requiresExactSize: boolean;
  readonly sortOrder: number;
};

export type ProductMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateProductInput(input: ProductCoreInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (input.minWidthMm > input.maxWidthMm || input.minHeightMm > input.maxHeightMm) {
    return 'Minimalny wymiar nie może być większy od maksymalnego.';
  }
  if (input.minPriceGrosze > input.basePriceGrosze) {
    return 'Cena minimalna nie może być wyższa od ceny bazowej.';
  }
  if (input.productionDaysMin > input.productionDaysMax) {
    return 'Minimalny czas realizacji nie może być dłuższy od maksymalnego.';
  }
  return null;
}

export async function applyCreateProduct(staff: CurrentSession, input: ProductCoreInput): Promise<ProductMutationResult> {
  const issue = validateProductInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const clashing = await prisma.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (clashing !== null) {
    return { ok: false, detail: 'Produkt z tym identyfikatorem URL już istnieje.' };
  }

  const product = await prisma.product.create({ data: input });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: product.id, action: 'create', diff: input });

  return { ok: true, id: product.id };
}

export async function createProduct(input: ProductCoreInput): Promise<ProductMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateProduct(staff, input);
  if (result.ok) {
    revalidatePath('/panel/produkty');
  }
  return result;
}

export async function applyUpdateProduct(
  staff: CurrentSession,
  id: string,
  input: ProductCoreInput,
): Promise<ProductMutationResult> {
  const issue = validateProductInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.product.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Produkt nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Produkt z tym identyfikatorem URL już istnieje.' };
    }
  }

  await prisma.product.update({ where: { id }, data: input });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: id, action: 'update', diff: { before: current, after: input } });

  return { ok: true, id };
}

export async function updateProduct(id: string, input: ProductCoreInput): Promise<ProductMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateProduct(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/produkty');
    revalidatePath(`/panel/produkty/${id}`);
  }
  return result;
}

export async function applySetProductActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.product.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'Product',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });

}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetProductActive(staff, id, isActive);
  revalidatePath('/panel/produkty');
  revalidatePath(`/panel/produkty/${id}`);
}

export async function applySetProductSortOrder(staff: CurrentSession, id: string, sortOrder: number): Promise<void> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return;
  }
  const current = await prisma.product.findUnique({ where: { id }, select: { sortOrder: true } });
  if (current === null) {
    return;
  }
  await prisma.product.update({ where: { id }, data: { sortOrder } });
  await writeAuditLog({
    actor: staff,
    entity: 'Product',
    entityId: id,
    action: 'update',
    diff: { sortOrder: { from: current.sortOrder, to: sortOrder } },
  });
}

export async function setProductSortOrder(id: string, sortOrder: number): Promise<void> {
  const staff = await requireStaffSession();
  await applySetProductSortOrder(staff, id, sortOrder);
  revalidatePath('/panel/produkty');
  revalidatePath(`/panel/produkty/${id}`);
}

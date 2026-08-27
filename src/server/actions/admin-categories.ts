'use server';

/**
 * Staff category mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split
 * P7a's `admin-orders.ts` established: the pure half takes the staff actor
 * explicitly (testable against real Postgres), the real Server Action
 * derives it via `requireStaffSession()` (reads `next/headers`, only works
 * inside a real request).
 *
 * No delete action exists here on purpose — `Category` is a real FK target
 * (`Product.categoryId`); §16A.2's soft-delete invariant means
 * `setCategoryActive` is the only way to retire one.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type CategoryFormInput = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
};

export type CategoryMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateCategoryInput(input: CategoryFormInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  return null;
}

export async function applyCreateCategory(
  staff: CurrentSession,
  input: CategoryFormInput,
): Promise<CategoryMutationResult> {
  const issue = validateCategoryInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const existing = await prisma.category.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Kategoria z tym identyfikatorem URL już istnieje.' };
  }

  const category = await prisma.category.create({
    data: {
      slug: input.slug,
      namePl: input.namePl,
      descPl: input.descPl,
      seoTitlePl: input.seoTitlePl,
      seoDescPl: input.seoDescPl,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    },
  });
  await writeAuditLog({ actor: staff, entity: 'Category', entityId: category.id, action: 'create', diff: input });

  return { ok: true, id: category.id };
}

export async function createCategory(input: CategoryFormInput): Promise<CategoryMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateCategory(staff, input);
  if (result.ok) {
    revalidatePath('/panel/kategorie');
  }
  return result;
}

export async function applyUpdateCategory(
  staff: CurrentSession,
  id: string,
  input: CategoryFormInput,
): Promise<CategoryMutationResult> {
  const issue = validateCategoryInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const current = await prisma.category.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Kategoria nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.category.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Kategoria z tym identyfikatorem URL już istnieje.' };
    }
  }

  await prisma.category.update({
    where: { id },
    data: {
      slug: input.slug,
      namePl: input.namePl,
      descPl: input.descPl,
      seoTitlePl: input.seoTitlePl,
      seoDescPl: input.seoDescPl,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    },
  });
  await writeAuditLog({
    actor: staff,
    entity: 'Category',
    entityId: id,
    action: 'update',
    diff: { before: current, after: input },
  });

  return { ok: true, id };
}

export async function updateCategory(id: string, input: CategoryFormInput): Promise<CategoryMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateCategory(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/kategorie');
    revalidatePath(`/panel/kategorie/${id}`);
  }
  return result;
}

export async function applySetCategoryActive(
  staff: CurrentSession,
  id: string,
  isActive: boolean,
): Promise<CategoryMutationResult> {
  const current = await prisma.category.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return { ok: false, detail: 'Kategoria nie istnieje.' };
  }

  await prisma.category.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'Category',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });

  return { ok: true, id };
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetCategoryActive(staff, id, isActive);
  revalidatePath('/panel/kategorie');
  revalidatePath(`/panel/kategorie/${id}`);
}

export async function applySetCategorySortOrder(
  staff: CurrentSession,
  id: string,
  sortOrder: number,
): Promise<CategoryMutationResult> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { ok: false, detail: 'Kolejność wyświetlania musi być liczbą całkowitą nieujemną.' };
  }

  const current = await prisma.category.findUnique({ where: { id }, select: { sortOrder: true } });
  if (current === null) {
    return { ok: false, detail: 'Kategoria nie istnieje.' };
  }

  await prisma.category.update({ where: { id }, data: { sortOrder } });
  await writeAuditLog({
    actor: staff,
    entity: 'Category',
    entityId: id,
    action: 'update',
    diff: { sortOrder: { from: current.sortOrder, to: sortOrder } },
  });

  return { ok: true, id };
}

export async function setCategorySortOrder(id: string, sortOrder: number): Promise<void> {
  const staff = await requireStaffSession();
  await applySetCategorySortOrder(staff, id, sortOrder);
  revalidatePath('/panel/kategorie');
  revalidatePath(`/panel/kategorie/${id}`);
}

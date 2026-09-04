/**
 * Staff category mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split
 * P7a's `admin-orders.ts` established: the pure half takes the staff actor
 * explicitly (testable against real Postgres), the real Server Action
 * derives it via `requireStaffSession()` (reads `next/headers`, only works
 * inside a real request).
 *
 * No delete action exists here on purpose - `Category` is a real FK target
 * (`Product.categoryId`); §16A.2's soft-delete invariant means
 * `setCategoryActive` is the only way to retire one.
 */

import { revalidatePath } from 'next/cache';

import Papa from 'papaparse';

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

/**
 * Bulk activate/deactivate from the grid's selection toolbar (P7c). Reuses
 * `applySetCategoryActive` per row - same validation, same audit trail, one
 * entry per row rather than a single "bulk" entry - so a bulk action is
 * indistinguishable in the audit log from doing the same rows one at a time.
 */
export async function applyBulkSetCategoryActive(staff: CurrentSession, ids: readonly string[], isActive: boolean): Promise<void> {
  for (const id of ids) {
    await applySetCategoryActive(staff, id, isActive);
  }
}

export async function bulkSetCategoryActive(ids: readonly string[], isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applyBulkSetCategoryActive(staff, ids, isActive);
  revalidatePath('/panel/kategorie');
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

// --- CSV import ------------------------------------------------------------
//
// Expected header row: slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder
// (imageUrl and sortOrder are optional - a blank cell means null/0). Every
// row goes through the exact same `applyCreateCategory` a manual create
// does - same validation, same duplicate-slug check, same audit log - so
// an imported row is indistinguishable from a hand-typed one afterward. A
// bad row does not abort the batch: this reports per-row success/failure
// instead of an all-or-nothing transaction, since a staff member fixing a
// 200-row CSV wants to know exactly which rows to fix, not "row 47 failed,
// nothing happened."

export type CategoryCsvRowResult = {
  readonly row: number;
  readonly slug: string;
  readonly ok: boolean;
  readonly detail: string | null;
};

export type ImportCategoriesResult =
  | { readonly ok: true; readonly createdCount: number; readonly rows: readonly CategoryCsvRowResult[] }
  | { readonly ok: false; readonly detail: string };

function csvCell(record: Record<string, string>, key: string): string {
  return (record[key] ?? '').trim();
}

export async function applyImportCategoriesFromCsv(staff: CurrentSession, csvText: string): Promise<ImportCategoriesResult> {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.data.length === 0) {
    return { ok: false, detail: 'Plik CSV nie zawiera żadnych wierszy z danymi.' };
  }

  const rows: CategoryCsvRowResult[] = [];
  let createdCount = 0;
  for (const [index, record] of parsed.data.entries()) {
    const rowNumber = index + 2; // header is row 1, so the first data row is row 2 - matches what a staff member sees in a spreadsheet
    const slug = csvCell(record, 'slug');
    const sortOrderRaw = csvCell(record, 'sortOrder');
    const imageUrl = csvCell(record, 'imageUrl');
    const input: CategoryFormInput = {
      slug,
      namePl: csvCell(record, 'namePl'),
      descPl: csvCell(record, 'descPl'),
      seoTitlePl: csvCell(record, 'seoTitlePl'),
      seoDescPl: csvCell(record, 'seoDescPl'),
      imageUrl: imageUrl.length > 0 ? imageUrl : null,
      sortOrder: sortOrderRaw.length > 0 && Number.isInteger(Number(sortOrderRaw)) ? Number(sortOrderRaw) : 0,
    };
    const result = await applyCreateCategory(staff, input);
    if (result.ok) {
      createdCount += 1;
    }
    rows.push({ row: rowNumber, slug, ok: result.ok, detail: result.ok ? null : result.detail });
  }

  return { ok: true, createdCount, rows };
}

export async function importCategoriesFromCsv(formData: FormData): Promise<ImportCategoriesResult> {
  const staff = await requireStaffSession();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detail: 'Wybierz plik CSV.' };
  }
  const csvText = await file.text();
  const result = await applyImportCategoriesFromCsv(staff, csvText);
  if (result.ok && result.createdCount > 0) {
    revalidatePath('/panel/kategorie');
  }
  return result;
}

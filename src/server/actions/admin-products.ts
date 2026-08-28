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
import { redirect } from 'next/navigation';
import Papa from 'papaparse';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { nextAvailableSlug } from '@/server/util/unique-slug';
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

/** Bulk activate/deactivate from the grid's selection toolbar (P7c) — see `admin-categories.ts`'s `bulkSetCategoryActive` for the pattern. */
export async function applyBulkSetProductActive(staff: CurrentSession, ids: readonly string[], isActive: boolean): Promise<void> {
  for (const id of ids) {
    await applySetProductActive(staff, id, isActive);
  }
}

export async function bulkSetProductActive(ids: readonly string[], isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applyBulkSetProductActive(staff, ids, isActive);
  revalidatePath('/panel/produkty');
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

/**
 * Copies the core scalar record only — not preset sizes, thicknesses,
 * material/design compatibility, install variants, or images, all of
 * which live on other tables and are frequently product-specific enough
 * that copying them silently would be more misleading than helpful.
 * Starts inactive so a half-set-up duplicate never goes live by
 * accident, and the new slug/name are visibly marked so it's never
 * confused with the original in a list.
 */
export async function applyDuplicateProduct(staff: CurrentSession, id: string): Promise<ProductMutationResult> {
  const original = await prisma.product.findUnique({ where: { id } });
  if (original === null) {
    return { ok: false, detail: 'Produkt nie istnieje.' };
  }

  const slug = await nextAvailableSlug(
    original.slug,
    async (candidate) => (await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })) !== null,
  );

  const input: ProductCoreInput = {
    slug,
    typeCode: original.typeCode,
    categoryId: original.categoryId,
    namePl: `${original.namePl} (kopia)`,
    shortDescPl: original.shortDescPl,
    longDescPl: original.longDescPl,
    careInstructionsPl: original.careInstructionsPl,
    installationInfoPl: original.installationInfoPl,
    materialNotesPl: original.materialNotesPl,
    seoTitlePl: original.seoTitlePl,
    seoDescPl: original.seoDescPl,
    basePriceGrosze: original.basePriceGrosze,
    minPriceGrosze: original.minPriceGrosze,
    productionDaysMin: original.productionDaysMin,
    productionDaysMax: original.productionDaysMax,
    minWidthMm: original.minWidthMm,
    maxWidthMm: original.maxWidthMm,
    minHeightMm: original.minHeightMm,
    maxHeightMm: original.maxHeightMm,
    allowsCustomSize: original.allowsCustomSize,
    requiresExactSize: original.requiresExactSize,
    sortOrder: original.sortOrder,
  };

  const created = await prisma.product.create({ data: { ...input, isActive: false } });
  await writeAuditLog({
    actor: staff,
    entity: 'Product',
    entityId: created.id,
    action: 'create',
    diff: { ...input, duplicatedFromId: id },
  });

  return { ok: true, id: created.id };
}

export async function duplicateProduct(id: string): Promise<ProductMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyDuplicateProduct(staff, id);
  if (result.ok) {
    revalidatePath('/panel/produkty');
  }
  return result;
}

/** Bound directly to `DuplicateButton`'s zero-JS form — real failure is not
 * reachable from that button (the id always comes from a record already
 * loaded on the page), so a plain redirect-on-success is enough; matches
 * `ActiveToggleButton`'s own `() => Promise<void>` shape. */
export async function duplicateProductAndGo(id: string): Promise<void> {
  const result = await duplicateProduct(id);
  if (result.ok) {
    redirect(`/panel/produkty/${result.id}`);
  }
}

// --- CSV import --------------------------------------------------------
//
// Expected header row: slug,typeCode,categorySlug,namePl,shortDescPl,
// longDescPl,careInstructionsPl,installationInfoPl,materialNotesPl,
// seoTitlePl,seoDescPl,basePriceGrosze,minPriceGrosze,productionDaysMin,
// productionDaysMax,minWidthMm,maxWidthMm,minHeightMm,maxHeightMm,
// allowsCustomSize,requiresExactSize,sortOrder — same pattern as
// `admin-categories.ts`'s `applyImportCategoriesFromCsv`, with one addition:
// `Product` has no image of its own (images are the separate nested
// `ProductImage` editor, out of scope for a flat CSV row), but it does have
// a required `categoryId` foreign key — the CSV carries the human-readable
// `categorySlug` instead and this resolves it to an id per row, reporting a
// per-row failure (not aborting the batch) when the slug doesn't exist.
// Numeric/boolean columns are parsed defensively: an invalid or missing
// required number fails that row with a specific message rather than
// silently defaulting to 0, which would create a broken product (e.g. a
// 0 zł price) that looks like a successful import.

export type ProductCsvRowResult = {
  readonly row: number;
  readonly slug: string;
  readonly ok: boolean;
  readonly detail: string | null;
};

export type ImportProductsResult =
  | { readonly ok: true; readonly createdCount: number; readonly rows: readonly ProductCsvRowResult[] }
  | { readonly ok: false; readonly detail: string };

const PRODUCT_TYPE_CODES: readonly ProductTypeCode[] = [
  'WALL_ART',
  'TABLE_TOP',
  'KITCHEN_TILE',
  'FLOOR_ELEMENT',
  'CUSTOM',
  'LOFT_FURNITURE',
  'JEWELRY',
];

function csvCell(record: Record<string, string>, key: string): string {
  return (record[key] ?? '').trim();
}

function csvRequiredInt(record: Record<string, string>, key: string): number | null {
  const raw = csvCell(record, key);
  if (raw.length === 0 || !Number.isInteger(Number(raw)) || Number(raw) < 0) {
    return null;
  }
  return Number(raw);
}

function csvBool(record: Record<string, string>, key: string): boolean {
  const raw = csvCell(record, key).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'tak';
}

export async function applyImportProductsFromCsv(staff: CurrentSession, csvText: string): Promise<ImportProductsResult> {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.data.length === 0) {
    return { ok: false, detail: 'Plik CSV nie zawiera żadnych wierszy z danymi.' };
  }

  const rows: ProductCsvRowResult[] = [];
  let createdCount = 0;
  for (const [index, record] of parsed.data.entries()) {
    const rowNumber = index + 2;
    const slug = csvCell(record, 'slug');

    const typeCode = csvCell(record, 'typeCode');
    if (!(PRODUCT_TYPE_CODES as readonly string[]).includes(typeCode)) {
      rows.push({ row: rowNumber, slug, ok: false, detail: `Nieprawidłowy typ produktu: "${typeCode}".` });
      continue;
    }

    const categorySlug = csvCell(record, 'categorySlug');
    const category = await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    if (category === null) {
      rows.push({ row: rowNumber, slug, ok: false, detail: `Nie znaleziono kategorii o identyfikatorze URL "${categorySlug}".` });
      continue;
    }

    const numericFields = {
      basePriceGrosze: csvRequiredInt(record, 'basePriceGrosze'),
      minPriceGrosze: csvRequiredInt(record, 'minPriceGrosze'),
      productionDaysMin: csvRequiredInt(record, 'productionDaysMin'),
      productionDaysMax: csvRequiredInt(record, 'productionDaysMax'),
      minWidthMm: csvRequiredInt(record, 'minWidthMm'),
      maxWidthMm: csvRequiredInt(record, 'maxWidthMm'),
      minHeightMm: csvRequiredInt(record, 'minHeightMm'),
      maxHeightMm: csvRequiredInt(record, 'maxHeightMm'),
    };
    const missingField = Object.entries(numericFields).find(([, value]) => value === null)?.[0];
    if (missingField !== undefined) {
      rows.push({ row: rowNumber, slug, ok: false, detail: `Brak lub nieprawidłowa wartość liczbowa w kolumnie "${missingField}".` });
      continue;
    }

    const installationInfoPl = csvCell(record, 'installationInfoPl');
    const materialNotesPl = csvCell(record, 'materialNotesPl');
    const sortOrderRaw = csvCell(record, 'sortOrder');
    const input: ProductCoreInput = {
      slug,
      typeCode: typeCode as ProductTypeCode,
      categoryId: category.id,
      namePl: csvCell(record, 'namePl'),
      shortDescPl: csvCell(record, 'shortDescPl'),
      longDescPl: csvCell(record, 'longDescPl'),
      careInstructionsPl: csvCell(record, 'careInstructionsPl'),
      installationInfoPl: installationInfoPl.length > 0 ? installationInfoPl : null,
      materialNotesPl: materialNotesPl.length > 0 ? materialNotesPl : null,
      seoTitlePl: csvCell(record, 'seoTitlePl'),
      seoDescPl: csvCell(record, 'seoDescPl'),
      basePriceGrosze: numericFields.basePriceGrosze as number,
      minPriceGrosze: numericFields.minPriceGrosze as number,
      productionDaysMin: numericFields.productionDaysMin as number,
      productionDaysMax: numericFields.productionDaysMax as number,
      minWidthMm: numericFields.minWidthMm as number,
      maxWidthMm: numericFields.maxWidthMm as number,
      minHeightMm: numericFields.minHeightMm as number,
      maxHeightMm: numericFields.maxHeightMm as number,
      allowsCustomSize: csvBool(record, 'allowsCustomSize'),
      requiresExactSize: csvBool(record, 'requiresExactSize'),
      sortOrder: sortOrderRaw.length > 0 && Number.isInteger(Number(sortOrderRaw)) ? Number(sortOrderRaw) : 0,
    };

    const result = await applyCreateProduct(staff, input);
    if (result.ok) {
      createdCount += 1;
    }
    rows.push({ row: rowNumber, slug, ok: result.ok, detail: result.ok ? null : result.detail });
  }

  return { ok: true, createdCount, rows };
}

export async function importProductsFromCsv(formData: FormData): Promise<ImportProductsResult> {
  const staff = await requireStaffSession();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detail: 'Wybierz plik CSV.' };
  }
  const csvText = await file.text();
  const result = await applyImportProductsFromCsv(staff, csvText);
  if (result.ok && result.createdCount > 0) {
    revalidatePath('/panel/produkty');
  }
  return result;
}

import { afterEach, describe, expect, it } from 'vitest';

import {
  applyBulkSetCategoryActive,
  applyCreateCategory,
  applyImportCategoriesFromCsv,
  applySetCategoryActive,
  applySetCategorySortOrder,
  applyUpdateCategory,
} from '@/server/operations/admin-categories';
import type { CategoryFormInput } from '@/server/operations/admin-categories';
import { queryActiveCategories } from '@/server/repositories/categories';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-categories-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function categoryInput(overrides: Partial<CategoryFormInput> = {}): CategoryFormInput {
  return {
    slug: uid(),
    namePl: 'Testowa kategoria',
    descPl: 'Opis',
    seoTitlePl: 'SEO',
    seoDescPl: 'SEO opis',
    imageUrl: null,
    sortOrder: 0,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateCategory', () => {
  it('creates a category and audits it', async () => {
    const staff = staffActor();
    const input = categoryInput();

    const result = await applyCreateCategory(staff, input);
    expect(result.ok).toBe(true);

    const category = await prisma.category.findUnique({ where: { slug: input.slug } });
    expect(category?.namePl).toBe(input.namePl);
    expect(await prisma.auditLog.count({ where: { entity: 'Category', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const input = categoryInput();
    await applyCreateCategory(staff, input);

    const result = await applyCreateCategory(staff, categoryInput({ slug: input.slug }));
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid slug', async () => {
    const result = await applyCreateCategory(staffActor(), categoryInput({ slug: 'Not A Slug!' }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateCategory', () => {
  it('updates fields and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateCategory(staff, categoryInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await applyUpdateCategory(staff, created.id, categoryInput({ namePl: 'Zmieniona nazwa' }));
    expect(result.ok).toBe(true);

    const category = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(category.namePl).toBe('Zmieniona nazwa');
  });
});

describe('applySetCategoryActive', () => {
  /**
   * `queryActiveCategories`, not `listActiveCategories` - changed 2026-08-31
   * with PERF-01. The storefront's read is now `unstable_cache`-wrapped and
   * invalidated by `revalidateTag` from the `'use server'` wrapper, which
   * this test cannot call (it needs a real request). Asserting through the
   * cached function would test the cache, not the deactivation rule this
   * test is about, and would fail for the right reason in the wrong place.
   * The invalidation half is covered by `tests/unit/cache-tags.test.ts`.
   */
  it('deactivating removes the category from the real storefront query without deleting it', async () => {
    const staff = staffActor();
    const created = await applyCreateCategory(staff, categoryInput());
    if (!created.ok) throw new Error('setup failed');
    const slug = (await prisma.category.findUniqueOrThrow({ where: { id: created.id } })).slug;

    expect((await queryActiveCategories()).some((c) => c.slug === slug)).toBe(true);

    await applySetCategoryActive(staff, created.id, false);

    expect((await queryActiveCategories()).some((c) => c.slug === slug)).toBe(false);
    expect(await prisma.category.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applyBulkSetCategoryActive', () => {
  it('deactivates every id in the batch and audits each one', async () => {
    const staff = staffActor();
    const first = await applyCreateCategory(staff, categoryInput());
    const second = await applyCreateCategory(staff, categoryInput());
    if (!first.ok || !second.ok) throw new Error('setup failed');

    await applyBulkSetCategoryActive(staff, [first.id, second.id], false);

    const rows = await prisma.category.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(rows.every((c) => c.isActive === false)).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { entity: 'Category', entityId: { in: [first.id, second.id] }, action: 'update', actorEmail: staff.email },
      }),
    ).toBe(2);
  });
});

describe('applySetCategorySortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateCategory(staff, categoryInput({ sortOrder: 0 }));
    if (!created.ok) throw new Error('setup failed');

    const result = await applySetCategorySortOrder(staff, created.id, 5);
    expect(result.ok).toBe(true);

    const category = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(category.sortOrder).toBe(5);
    expect(await prisma.auditLog.count({ where: { entity: 'Category', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const created = await applyCreateCategory(staff, categoryInput({ sortOrder: 3 }));
    if (!created.ok) throw new Error('setup failed');

    expect((await applySetCategorySortOrder(staff, created.id, -1)).ok).toBe(false);
    expect((await applySetCategorySortOrder(staff, created.id, 1.5)).ok).toBe(false);

    const category = await prisma.category.findUniqueOrThrow({ where: { id: created.id } });
    expect(category.sortOrder).toBe(3);
  });
});

describe('applyImportCategoriesFromCsv', () => {
  it('creates every valid row, real ones, going through the exact same audited path as a manual create', async () => {
    const staff = staffActor();
    const slugA = uid();
    const slugB = uid();
    const csv = [
      'slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder',
      `${slugA},Kategoria A,Opis A,SEO A,SEO opis A,,3`,
      `${slugB},Kategoria B,Opis B,SEO B,SEO opis B,https://example.test/b.jpg,7`,
    ].join('\n');

    const result = await applyImportCategoriesFromCsv(staff, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.createdCount).toBe(2);
    expect(result.rows.every((r) => r.ok)).toBe(true);

    const a = await prisma.category.findUniqueOrThrow({ where: { slug: slugA } });
    expect(a.namePl).toBe('Kategoria A');
    expect(a.imageUrl).toBeNull();
    expect(a.sortOrder).toBe(3);

    const b = await prisma.category.findUniqueOrThrow({ where: { slug: slugB } });
    expect(b.imageUrl).toBe('https://example.test/b.jpg');
    expect(b.sortOrder).toBe(7);

    expect(await prisma.auditLog.count({ where: { entity: 'Category', action: 'create', actorEmail: staff.email } })).toBe(2);
  });

  it('reports a bad row without aborting the rest of the batch', async () => {
    const staff = staffActor();
    const slugGood = uid();
    const csv = [
      'slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder',
      'Not A Slug!,Zły wiersz,Opis,SEO,SEO opis,,0',
      `${slugGood},Dobry wiersz,Opis,SEO,SEO opis,,0`,
    ].join('\n');

    const result = await applyImportCategoriesFromCsv(staff, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.createdCount).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.ok).toBe(false);
    expect(result.rows[0]?.row).toBe(2);
    expect(result.rows[1]?.ok).toBe(true);
    expect(result.rows[1]?.row).toBe(3);

    expect(await prisma.category.findUnique({ where: { slug: slugGood } })).not.toBeNull();
  });

  it('reports a duplicate slug within the same file as a per-row failure on the second occurrence', async () => {
    const staff = staffActor();
    const slug = uid();
    const csv = [
      'slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder',
      `${slug},Pierwsza,Opis,SEO,SEO opis,,0`,
      `${slug},Duplikat,Opis,SEO,SEO opis,,0`,
    ].join('\n');

    const result = await applyImportCategoriesFromCsv(staff, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.createdCount).toBe(1);
    expect(result.rows[0]?.ok).toBe(true);
    expect(result.rows[1]?.ok).toBe(false);
  });

  it('rejects a CSV with no data rows', async () => {
    const result = await applyImportCategoriesFromCsv(staffActor(), 'slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder\n');
    expect(result.ok).toBe(false);
  });

  it('preserves Polish diacritics through the CSV round trip', async () => {
    const staff = staffActor();
    const slug = uid();
    const csv = `slug,namePl,descPl,seoTitlePl,seoDescPl,imageUrl,sortOrder\n${slug},Żółw i dąb - ćma łąka źrebię,Opis,SEO,SEO opis,,0\n`;

    const result = await applyImportCategoriesFromCsv(staff, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.createdCount).toBe(1);

    const category = await prisma.category.findUniqueOrThrow({ where: { slug } });
    expect(category.namePl).toBe('Żółw i dąb - ćma łąka źrebię');
  });
});

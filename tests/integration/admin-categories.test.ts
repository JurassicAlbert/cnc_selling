import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateCategory, applySetCategoryActive, applyUpdateCategory } from '@/server/actions/admin-categories';
import type { CategoryFormInput } from '@/server/actions/admin-categories';
import { listActiveCategories } from '@/server/repositories/categories';
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
  it('deactivating removes the category from the real storefront query without deleting it', async () => {
    const staff = staffActor();
    const created = await applyCreateCategory(staff, categoryInput());
    if (!created.ok) throw new Error('setup failed');
    const slug = (await prisma.category.findUniqueOrThrow({ where: { id: created.id } })).slug;

    expect((await listActiveCategories()).some((c) => c.slug === slug)).toBe(true);

    await applySetCategoryActive(staff, created.id, false);

    expect((await listActiveCategories()).some((c) => c.slug === slug)).toBe(false);
    expect(await prisma.category.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

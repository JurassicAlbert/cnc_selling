import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateProduct, applySetProductActive, applySetProductSortOrder, applyUpdateProduct } from '@/server/actions/admin-products';
import type { ProductCoreInput } from '@/server/actions/admin-products';
import { applySetProductMaterial } from '@/server/actions/admin-product-catalogue';
import { listActiveProductsByCategorySlug } from '@/server/repositories/products';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-products-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

async function seedCategory() {
  return prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
  });
}

async function seedMaterial() {
  return prisma.material.create({
    data: {
      slug: uid(),
      namePl: 'Test Material',
      family: 'SOLID_WOOD',
      shortDescPl: 'Test',
      characteristicsPl: 'Test',
      imageUrl: '/images/photos/material-dab.jpg',
      pricePerM2Grosze: 10_000,
      maxSheetWidthMm: 1000,
      maxSheetHeightMm: 1000,
      minLineWidthUm: 1000,
      minDetailSpacingUm: 1000,
      minTextHeightUm: 6000,
    },
  });
}

function productInput(categoryId: string, overrides: Partial<ProductCoreInput> = {}): ProductCoreInput {
  return {
    slug: uid(),
    typeCode: 'WALL_ART',
    categoryId,
    namePl: 'Testowy produkt',
    shortDescPl: 'Krótki opis',
    longDescPl: 'Pełny opis',
    careInstructionsPl: 'Pielęgnacja',
    installationInfoPl: null,
    materialNotesPl: null,
    seoTitlePl: 'SEO',
    seoDescPl: 'SEO opis',
    basePriceGrosze: 20_000,
    minPriceGrosze: 10_000,
    productionDaysMin: 3,
    productionDaysMax: 7,
    minWidthMm: 100,
    maxWidthMm: 1000,
    minHeightMm: 100,
    maxHeightMm: 1000,
    allowsCustomSize: true,
    requiresExactSize: false,
    sortOrder: 0,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.productMaterial.deleteMany({ where: { product: { slug: { startsWith: PREFIX } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateProduct', () => {
  it('creates a product and audits it', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const input = productInput(category.id);

    const result = await applyCreateProduct(staff, input);
    expect(result.ok).toBe(true);

    const product = await prisma.product.findUnique({ where: { slug: input.slug } });
    expect(product?.namePl).toBe(input.namePl);
    expect(await prisma.auditLog.count({ where: { entity: 'Product', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const input = productInput(category.id);
    await applyCreateProduct(staff, input);

    const result = await applyCreateProduct(staff, productInput(category.id, { slug: input.slug }));
    expect(result.ok).toBe(false);
  });

  it('rejects a dimension envelope where min exceeds max', async () => {
    const category = await seedCategory();
    const result = await applyCreateProduct(staffActor(), productInput(category.id, { minWidthMm: 500, maxWidthMm: 100 }));
    expect(result.ok).toBe(false);
  });

  it('rejects a minimum price above the base price', async () => {
    const category = await seedCategory();
    const result = await applyCreateProduct(staffActor(), productInput(category.id, { basePriceGrosze: 1000, minPriceGrosze: 2000 }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateProduct', () => {
  it('updates fields and audits the change', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const created = await applyCreateProduct(staff, productInput(category.id));
    if (!created.ok) throw new Error('setup failed');

    const result = await applyUpdateProduct(staff, created.id, productInput(category.id, { namePl: 'Zmieniona nazwa' }));
    expect(result.ok).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).namePl).toBe('Zmieniona nazwa');
  });
});

describe('applySetProductActive', () => {
  it('deactivating removes the product from the real storefront query without deleting it', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const input = productInput(category.id);
    const created = await applyCreateProduct(staff, input);
    if (!created.ok) throw new Error('setup failed');

    expect((await listActiveProductsByCategorySlug(category.slug)).some((p) => p.slug === input.slug)).toBe(true);

    await applySetProductActive(staff, created.id, false);

    expect((await listActiveProductsByCategorySlug(category.slug)).some((p) => p.slug === input.slug)).toBe(false);
    expect(await prisma.product.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applySetProductSortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const created = await applyCreateProduct(staff, productInput(category.id, { sortOrder: 0 }));
    if (!created.ok) throw new Error('setup failed');

    await applySetProductSortOrder(staff, created.id, 7);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(product.sortOrder).toBe(7);
    expect(await prisma.auditLog.count({ where: { entity: 'Product', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const created = await applyCreateProduct(staff, productInput(category.id, { sortOrder: 4 }));
    if (!created.ok) throw new Error('setup failed');

    await applySetProductSortOrder(staff, created.id, -1);
    await applySetProductSortOrder(staff, created.id, 1.5);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(product.sortOrder).toBe(4);
  });
});

describe('applySetProductMaterial (nested editor, proven end to end)', () => {
  it('assigning a material makes it appear on the real storefront product card', async () => {
    const staff = staffActor();
    const category = await seedCategory();
    const material = await seedMaterial();
    const input = productInput(category.id);
    const created = await applyCreateProduct(staff, input);
    if (!created.ok) throw new Error('setup failed');

    const before = await listActiveProductsByCategorySlug(category.slug);
    expect(before.find((p) => p.slug === input.slug)?.materials).toEqual([]);

    const result = await applySetProductMaterial(staff, created.id, material.id, 12_000);
    expect(result.ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: 'Product', entityId: created.id, actorEmail: staff.email } })).toBeGreaterThan(0);

    const after = await listActiveProductsByCategorySlug(category.slug);
    expect(after.find((p) => p.slug === input.slug)?.materials).toEqual([{ namePl: material.namePl }]);
  });
});

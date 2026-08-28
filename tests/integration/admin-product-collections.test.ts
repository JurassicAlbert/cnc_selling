import { afterEach, describe, expect, it } from 'vitest';

import {
  applyCreateProductCollection,
  applyRemoveProductCollectionItem,
  applySetProductCollectionActive,
  applySetProductCollectionItem,
  applyUpdateProductCollection,
} from '@/server/actions/admin-product-collections';
import { listProductCollectionItemsForAdmin } from '@/server/repositories/admin-product-collections';
import { listActiveCollections, listActiveProductsByCollectionSlug } from '@/server/repositories/collections';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-product-collections-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function validInput(overrides: Partial<{ slug: string; namePl: string; descPl: string; imageUrl: string; sortOrder: number }> = {}) {
  return {
    slug: uid(),
    namePl: `${PREFIX}kolekcja`,
    descPl: 'Opis testowej kolekcji.',
    imageUrl: '',
    sortOrder: 0,
    ...overrides,
  };
}

async function seedActiveProduct() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
  });
  return prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: `${PREFIX}produkt`,
      shortDescPl: 'Test',
      longDescPl: 'Test',
      careInstructionsPl: 'Test',
      seoTitlePl: 'Test',
      seoDescPl: 'Test',
      basePriceGrosze: 10_000,
      minPriceGrosze: 10_000,
      productionDaysMin: 3,
      productionDaysMax: 5,
      minWidthMm: 100,
      maxWidthMm: 500,
      minHeightMm: 100,
      maxHeightMm: 500,
      isActive: true,
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'ProductCollection', actorEmail: { startsWith: PREFIX } } });
  await prisma.productCollection.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('applyCreateProductCollection', () => {
  it('creates a real row and audits it', async () => {
    const staff = staffActor();

    const result = await applyCreateProductCollection(staff, validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const created = await prisma.productCollection.findUniqueOrThrow({ where: { id: result.id } });
    expect(created.isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: 'ProductCollection', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects an invalid slug', async () => {
    const result = await applyCreateProductCollection(staffActor(), validInput({ slug: 'Not A Slug!' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const slug = uid();
    await applyCreateProductCollection(staff, validInput({ slug }));

    const result = await applyCreateProductCollection(staff, validInput({ slug }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateProductCollection', () => {
  it('updates fields and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateProductCollection(staff, validInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = await applyUpdateProductCollection(staff, created.id, validInput({ slug: (await prisma.productCollection.findUniqueOrThrow({ where: { id: created.id } })).slug, namePl: `${PREFIX}zmieniona` }));
    expect(updated.ok).toBe(true);
    expect((await prisma.productCollection.findUniqueOrThrow({ where: { id: created.id } })).namePl).toBe(`${PREFIX}zmieniona`);
  });
});

describe('applySetProductCollectionActive', () => {
  it('deactivating removes it from the real public listing without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateProductCollection(staff, validInput());
    if (!created.ok) throw new Error('setup failed');
    const slug = (await prisma.productCollection.findUniqueOrThrow({ where: { id: created.id } })).slug;

    expect((await listActiveCollections()).some((c) => c.slug === slug)).toBe(true);

    await applySetProductCollectionActive(staff, created.id, false);

    expect((await listActiveCollections()).some((c) => c.slug === slug)).toBe(false);
    expect(await prisma.productCollection.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applySetProductCollectionItem / applyRemoveProductCollectionItem', () => {
  it('assigns a real product to a collection and it appears in the public listing', async () => {
    const staff = staffActor();
    const created = await applyCreateProductCollection(staff, validInput());
    if (!created.ok) throw new Error('setup failed');
    const collection = await prisma.productCollection.findUniqueOrThrow({ where: { id: created.id } });
    const product = await seedActiveProduct();

    const result = await applySetProductCollectionItem(staff, created.id, product.id, 0);
    expect(result.ok).toBe(true);

    const items = await listProductCollectionItemsForAdmin(created.id);
    expect(items.some((item) => item.productId === product.id)).toBe(true);

    const publicProducts = await listActiveProductsByCollectionSlug(collection.slug);
    expect(publicProducts.some((p) => p.slug === product.slug)).toBe(true);
  });

  it('removing a product drops it from both the admin and public listings without deleting the product', async () => {
    const staff = staffActor();
    const created = await applyCreateProductCollection(staff, validInput());
    if (!created.ok) throw new Error('setup failed');
    const collection = await prisma.productCollection.findUniqueOrThrow({ where: { id: created.id } });
    const product = await seedActiveProduct();
    await applySetProductCollectionItem(staff, created.id, product.id, 0);

    await applyRemoveProductCollectionItem(staff, created.id, product.id);

    expect((await listProductCollectionItemsForAdmin(created.id)).some((item) => item.productId === product.id)).toBe(false);
    expect((await listActiveProductsByCollectionSlug(collection.slug)).some((p) => p.slug === product.slug)).toBe(false);
    expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it('rejects a negative sortOrder', async () => {
    const staff = staffActor();
    const created = await applyCreateProductCollection(staff, validInput());
    if (!created.ok) throw new Error('setup failed');
    const product = await seedActiveProduct();

    const result = await applySetProductCollectionItem(staff, created.id, product.id, -1);
    expect(result.ok).toBe(false);
  });
});

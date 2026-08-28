import { afterEach, describe, expect, it } from 'vitest';

import { getActiveProductBySlug, getProductBySlugForPreview, listAllActiveProducts } from '@/server/repositories/products';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-product-preview-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedProduct(overrides: { isActive?: boolean; categoryActive?: boolean } = {}) {
  const category = await prisma.category.create({
    data: {
      slug: uid(),
      namePl: 'Test Category',
      descPl: 'Test',
      seoTitlePl: 'Test',
      seoDescPl: 'Test',
      isActive: overrides.categoryActive ?? true,
    },
  });
  const product = await prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: 'Testowy produkt podglądu',
      shortDescPl: 'Krótki opis',
      longDescPl: 'Pełny opis',
      careInstructionsPl: 'Pielęgnacja',
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
      isActive: overrides.isActive ?? true,
    },
  });
  return { category, product };
}

afterEach(async () => {
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('getActiveProductBySlug / getProductBySlugForPreview', () => {
  it('getActiveProductBySlug returns null for an inactive product', async () => {
    const { product } = await seedProduct({ isActive: false });
    expect(await getActiveProductBySlug(product.slug)).toBeNull();
  });

  it('getActiveProductBySlug returns the product when active', async () => {
    const { product } = await seedProduct({ isActive: true });
    expect((await getActiveProductBySlug(product.slug))?.namePl).toBe('Testowy produkt podglądu');
  });

  it('getProductBySlugForPreview returns an inactive product — the staff "preview as customer" bypass', async () => {
    const { product } = await seedProduct({ isActive: false });
    expect((await getProductBySlugForPreview(product.slug))?.namePl).toBe('Testowy produkt podglądu');
  });

  it('getProductBySlugForPreview returns the same shape for an active product too', async () => {
    const { product } = await seedProduct({ isActive: true });
    const active = await getActiveProductBySlug(product.slug);
    const preview = await getProductBySlugForPreview(product.slug);
    expect(preview).toEqual(active);
  });

  it('returns null for a genuinely nonexistent slug either way', async () => {
    expect(await getActiveProductBySlug(uid())).toBeNull();
    expect(await getProductBySlugForPreview(uid())).toBeNull();
  });
});

/**
 * 2026-08-28, owner feedback: deactivating Gres/Panele podłogowe's
 * *category* left their products still reachable everywhere except the
 * category page and nav — `listAllActiveProducts`/`getActiveProductBySlug`
 * only ever checked `product.isActive`, never `category.isActive`. Fixed
 * by joining `category: { isActive: true }` into every public product
 * query in `products.ts`; these tests are the real DB round-trip for that.
 */
describe('deactivated category cascades to its products', () => {
  it('getActiveProductBySlug returns null for an active product in an inactive category', async () => {
    const { product } = await seedProduct({ isActive: true, categoryActive: false });
    expect(await getActiveProductBySlug(product.slug)).toBeNull();
  });

  it('getProductBySlugForPreview still returns it — the staff bypass ignores category state too', async () => {
    const { product } = await seedProduct({ isActive: true, categoryActive: false });
    expect((await getProductBySlugForPreview(product.slug))?.namePl).toBe('Testowy produkt podglądu');
  });

  it('listAllActiveProducts excludes an active product whose category is inactive', async () => {
    const { product } = await seedProduct({ isActive: true, categoryActive: false });
    const all = await listAllActiveProducts();
    expect(all.some((p) => p.slug === product.slug)).toBe(false);
  });

  it('listAllActiveProducts includes an active product in an active category', async () => {
    const { product } = await seedProduct({ isActive: true, categoryActive: true });
    const all = await listAllActiveProducts();
    expect(all.some((p) => p.slug === product.slug)).toBe(true);
  });
});

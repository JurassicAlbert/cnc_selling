import { afterEach, describe, expect, it } from 'vitest';

import { getActiveProductBySlug, getProductBySlugForPreview } from '@/server/repositories/products';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-product-preview-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedProduct(overrides: { isActive?: boolean } = {}) {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
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

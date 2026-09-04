/**
 * The warehouse screen's central query, driven against a real database.
 *
 * `domain/stock/board.ts` proves the arithmetic. This proves the part the
 * arithmetic cannot: that the list only ever contains items the shop can
 * genuinely make today. A warehouse screen offering a retired product, or one
 * in a deactivated category, is worse than no screen. It is the same failure
 * `offered-is-buildable.test.ts` exists to prevent, one layer up.
 *
 * Self-contained catalogue, `test-` prefixed so `offered-is-buildable` does
 * not sweep these fixtures mid-run.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { reportWhatFitsOnBoard } from '@/server/stock/what-fits';

const PREFIX = 'test-whatfits-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

/** 2000 x 1250 x 18, bought for 320 zl net. */
const BOARD = { widthMm: 2000, heightMm: 1250, thicknessMm: 18, purchasePriceGrosze: 32_000 };

type Fixture = Awaited<ReturnType<typeof buildCatalogue>>;

const MATERIAL_BASE = {
  family: 'SOLID_WOOD' as const,
  shortDescPl: '.',
  characteristicsPl: '.',
  imageUrl: '/images/test.jpg',
  densityKgPerM3: 700,
  isAvailable: true,
  maxSheetWidthMm: 2000,
  maxSheetHeightMm: 2000,
  minLineWidthUm: 800,
  minDetailSpacingUm: 800,
  minTextHeightUm: 4000,
};

async function buildCatalogue() {
  const [activeCategory, inactiveCategory] = await Promise.all([
    prisma.category.create({
      data: { slug: uid(), namePl: 'Kategoria aktywna', descPl: '.', seoTitlePl: '.', seoDescPl: '.', isActive: true },
    }),
    prisma.category.create({
      data: { slug: uid(), namePl: 'Kategoria ukryta', descPl: '.', seoTitlePl: '.', seoDescPl: '.', isActive: false },
    }),
  ]);

  // 160 zl/m2 charged against the 128 zl/m2 the board cost: a 25% margin.
  const material = await prisma.material.create({
    data: { ...MATERIAL_BASE, slug: uid(), namePl: 'Material testowy', pricePerM2Grosze: 16_000 },
  });
  const otherMaterial = await prisma.material.create({
    data: { ...MATERIAL_BASE, slug: uid(), namePl: 'Inny material', pricePerM2Grosze: 16_000 },
  });

  const product = (overrides: {
    typeCode: 'WALL_ART' | 'TABLE_TOP';
    categoryId: string;
    isActive?: boolean;
    namePl: string;
  }) =>
    prisma.product.create({
      data: {
        slug: uid(),
        typeCode: overrides.typeCode,
        categoryId: overrides.categoryId,
        namePl: overrides.namePl,
        shortDescPl: '.',
        longDescPl: '.',
        careInstructionsPl: '.',
        seoTitlePl: '.',
        seoDescPl: '.',
        basePriceGrosze: 20_000,
        minPriceGrosze: 10_000,
        productionDaysMin: 3,
        productionDaysMax: 7,
        minWidthMm: 200,
        maxWidthMm: 3000,
        minHeightMm: 200,
        maxHeightMm: 3000,
        isActive: overrides.isActive ?? true,
      },
    });

  const [small, huge, retired, hidden, wrongMaterial, thick] = await Promise.all([
    product({ typeCode: 'WALL_ART', categoryId: activeCategory.id, namePl: 'Maly obraz' }),
    product({ typeCode: 'WALL_ART', categoryId: activeCategory.id, namePl: 'Ogromny obraz' }),
    product({ typeCode: 'WALL_ART', categoryId: activeCategory.id, namePl: 'Wycofany obraz', isActive: false }),
    product({ typeCode: 'WALL_ART', categoryId: inactiveCategory.id, namePl: 'Obraz w ukrytej kategorii' }),
    product({ typeCode: 'WALL_ART', categoryId: activeCategory.id, namePl: 'Obraz z innego materialu' }),
    product({ typeCode: 'TABLE_TOP', categoryId: activeCategory.id, namePl: 'Blat 27 mm' }),
  ]);

  await prisma.$transaction([
    prisma.productMaterial.createMany({
      data: [small, huge, retired, hidden, thick].map((p) => ({ productId: p.id, materialId: material.id })),
    }),
    prisma.productMaterial.create({ data: { productId: wrongMaterial.id, materialId: otherMaterial.id } }),
    prisma.productPresetSize.createMany({
      data: [
        { productId: small.id, widthMm: 500, heightMm: 250, labelPl: '50 x 25 cm' },
        { productId: huge.id, widthMm: 2400, heightMm: 1400, labelPl: '240 x 140 cm' },
        { productId: retired.id, widthMm: 500, heightMm: 250, labelPl: '50 x 25 cm' },
        { productId: hidden.id, widthMm: 500, heightMm: 250, labelPl: '50 x 25 cm' },
        { productId: wrongMaterial.id, widthMm: 500, heightMm: 250, labelPl: '50 x 25 cm' },
        { productId: thick.id, widthMm: 600, heightMm: 400, labelPl: '60 x 40 cm' },
      ],
    }),
    // TABLE_TOP has a THICKNESS step, and this product offers 27 mm only.
    prisma.productThickness.create({ data: { productId: thick.id, thicknessMm: 27, labelPl: '27 mm' } }),
    prisma.productImage.create({ data: { productId: small.id, url: '/images/small.jpg', altPl: '.', sortOrder: 0 } }),
  ]);

  return { materialId: material.id };
}

let fixture: Fixture;

beforeAll(async () => {
  fixture = await buildCatalogue();
});

afterAll(async () => {
  await prisma.productImage.deleteMany({ where: { product: { slug: { startsWith: PREFIX } } } });
  await prisma.productThickness.deleteMany({ where: { product: { slug: { startsWith: PREFIX } } } });
  await prisma.productPresetSize.deleteMany({ where: { product: { slug: { startsWith: PREFIX } } } });
  await prisma.productMaterial.deleteMany({ where: { product: { slug: { startsWith: PREFIX } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('reportWhatFitsOnBoard', () => {
  it('returns null for a material that does not exist', async () => {
    expect(await reportWhatFitsOnBoard('no-such-material', BOARD)).toBeNull();
  });

  it('reports what the board cost against what the catalogue charges', async () => {
    const report = await reportWhatFitsOnBoard(fixture.materialId, BOARD);

    expect(report?.costPerM2Grosze).toBe(12_800);
    expect(report?.chargedPerM2Grosze).toBe(16_000);
  });

  it('lists an item that fits, with its yield, its real material cost and its photo', async () => {
    const report = await reportWhatFitsOnBoard(fixture.materialId, BOARD);
    const item = report?.items.find((i) => i.namePl === 'Maly obraz');

    expect(item).toBeDefined();
    // 500 x 250 on 2000 x 1250: four across, five down.
    expect(item?.fitsPerBoard).toBe(20);
    // 0.125 m2 at 128 zl/m2.
    expect(item?.materialCostGrosze).toBe(1_600);
    expect(item?.imageUrl).toBe('/images/small.jpg');
    expect(item?.bestSize.labelPl).toBe('50 x 25 cm');
  });

  it('puts an item too big for the board on the tooLarge list, not silently out of sight', async () => {
    // "This board is too small for X" is the answer the operator came for
    // just as often as the positive one.
    const report = await reportWhatFitsOnBoard(fixture.materialId, BOARD);

    expect(report?.tooLarge.some((p) => p.namePl === 'Ogromny obraz')).toBe(true);
    expect(report?.items.some((i) => i.namePl === 'Ogromny obraz')).toBe(false);
  });

  it.each([
    ['a retired product', 'Wycofany obraz'],
    ['a product in a deactivated category', 'Obraz w ukrytej kategorii'],
    ['a product that does not offer this material', 'Obraz z innego materialu'],
  ])('never offers %s', async (_label, namePl) => {
    const report = await reportWhatFitsOnBoard(fixture.materialId, BOARD);

    expect(report?.items.some((i) => i.namePl === namePl)).toBe(false);
    expect(report?.tooLarge.some((p) => p.namePl === namePl)).toBe(false);
  });

  it('excludes a product whose thickness step does not match the board', async () => {
    // The blat offers 27 mm only; this board is 18 mm.
    const report = await reportWhatFitsOnBoard(fixture.materialId, BOARD);
    expect(report?.items.some((i) => i.namePl === 'Blat 27 mm')).toBe(false);
  });

  it('includes that same product once the board is the thickness it needs', async () => {
    const report = await reportWhatFitsOnBoard(fixture.materialId, { ...BOARD, thicknessMm: 27 });

    const blat = report?.items.find((i) => i.namePl === 'Blat 27 mm');
    expect(blat).toBeDefined();
    // 600 x 400 laid as-is is 3 across by 3 down, but rotated to 400 x 600
    // it is 5 across by 2 down. The better orientation wins.
    expect(blat?.fitsPerBoard).toBe(10);
  });

  it('shows no image rather than inventing one when a product has no photo', async () => {
    const report = await reportWhatFitsOnBoard(fixture.materialId, { ...BOARD, thicknessMm: 27 });
    expect(report?.items.find((i) => i.namePl === 'Blat 27 mm')?.imageUrl).toBeNull();
  });
});

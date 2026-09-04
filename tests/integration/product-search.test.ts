/**
 * `searchActiveProducts`, driven against a real database.
 *
 * It had no test at all until 2026-09-04, which stopped being acceptable the
 * moment UX-23 attached a category selector to the search field: a control
 * that narrows nothing is decoration, and this project's standing rule is
 * that a customer-facing control does the thing it appears to do.
 *
 * The cases that matter are the ones a customer can actually produce: a
 * phrase, a phrase inside one category, a category with no phrase at all
 * (they picked from the selector and pressed the button), and a category that
 * no longer exists (a stale bookmark, the same shape as UX-21's).
 *
 * Self-contained catalogue, `test-` prefixed so `offered-is-buildable` does
 * not sweep these fixtures mid-run.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { searchActiveProducts } from '@/server/repositories/products';

const PREFIX = 'test-search-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

type Fixture = Awaited<ReturnType<typeof buildCatalogue>>;

async function buildCatalogue() {
  const [wallArt, jewellery, hiddenCategory] = await Promise.all([
    prisma.category.create({
      data: { slug: uid(), namePl: 'Obrazy testowe', descPl: '.', seoTitlePl: '.', seoDescPl: '.', isActive: true },
    }),
    prisma.category.create({
      data: { slug: uid(), namePl: 'Bizuteria testowa', descPl: '.', seoTitlePl: '.', seoDescPl: '.', isActive: true },
    }),
    prisma.category.create({
      data: { slug: uid(), namePl: 'Kategoria ukryta', descPl: '.', seoTitlePl: '.', seoDescPl: '.', isActive: false },
    }),
  ]);

  const product = (overrides: {
    categoryId: string;
    namePl: string;
    shortDescPl: string;
    isActive?: boolean;
  }) =>
    prisma.product.create({
      data: {
        slug: uid(),
        typeCode: 'WALL_ART',
        categoryId: overrides.categoryId,
        namePl: overrides.namePl,
        shortDescPl: overrides.shortDescPl,
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

  await Promise.all([
    // The word "zolw" appears in three products across two categories, so a
    // category filter has something to actually remove.
    product({ categoryId: wallArt.id, namePl: 'Obraz zolw', shortDescPl: '.' }),
    product({ categoryId: wallArt.id, namePl: 'Obraz jelen', shortDescPl: 'Grawer zolwia w tle' }),
    product({ categoryId: jewellery.id, namePl: 'Bransoletka zolw', shortDescPl: '.' }),
    product({ categoryId: wallArt.id, namePl: 'Obraz wycofany zolw', shortDescPl: '.', isActive: false }),
    product({ categoryId: hiddenCategory.id, namePl: 'Obraz ukryty zolw', shortDescPl: '.' }),
  ]);

  return { wallArtSlug: wallArt.slug, jewellerySlug: jewellery.slug, hiddenSlug: hiddenCategory.slug };
}

let fixture: Fixture;
const names = (results: readonly { readonly namePl: string }[]): string[] =>
  results.map((r) => r.namePl).filter((name) => name.startsWith('Obraz') || name.startsWith('Bransoletka'));

beforeAll(async () => {
  fixture = await buildCatalogue();
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('searchActiveProducts - the phrase on its own', () => {
  it('matches the name and the short description, across categories', async () => {
    const found = names(await searchActiveProducts({ query: 'zolw' }));

    expect(found).toContain('Obraz zolw');
    expect(found).toContain('Bransoletka zolw');
    // Matched on its description, not its name.
    expect(found).toContain('Obraz jelen');
  });

  it('never returns a retired product or one in a deactivated category', async () => {
    const found = names(await searchActiveProducts({ query: 'zolw' }));

    expect(found).not.toContain('Obraz wycofany zolw');
    expect(found).not.toContain('Obraz ukryty zolw');
  });

  it('returns nothing for a blank query with no category', async () => {
    // The one genuinely empty request: someone pressed the button with an
    // empty field and the selector left on "wszystkie kategorie". Listing the
    // entire catalogue for that is not a search result.
    expect(await searchActiveProducts({ query: '   ' })).toEqual([]);
    expect(await searchActiveProducts({ query: '' })).toEqual([]);
  });
});

describe('searchActiveProducts - narrowed to a category', () => {
  it('keeps only the matches inside the chosen category', async () => {
    const found = names(await searchActiveProducts({ query: 'zolw', categorySlug: fixture.wallArtSlug }));

    expect(found).toContain('Obraz zolw');
    expect(found).toContain('Obraz jelen');
    expect(found).not.toContain('Bransoletka zolw');
  });

  it('lists the whole category when the phrase is empty', async () => {
    // The selector on its own is a real request - "show me what is in here" -
    // and answering it with nothing would make the control a dead end.
    const found = names(await searchActiveProducts({ query: '', categorySlug: fixture.jewellerySlug }));

    expect(found).toEqual(['Bransoletka zolw']);
  });

  it('still excludes retired products when listing a whole category', async () => {
    const found = names(await searchActiveProducts({ query: '', categorySlug: fixture.wallArtSlug }));

    expect(found).toContain('Obraz zolw');
    expect(found).not.toContain('Obraz wycofany zolw');
  });

  it('returns nothing for a category that is no longer active', async () => {
    // A stale bookmark naming a category the shop has since hidden. The same
    // shape as UX-21's stale link: refuse it rather than quietly widening the
    // search to everything.
    expect(await searchActiveProducts({ query: 'zolw', categorySlug: fixture.hiddenSlug })).toEqual([]);
    expect(await searchActiveProducts({ query: '', categorySlug: fixture.hiddenSlug })).toEqual([]);
  });

  it('returns nothing for a category slug that does not exist', async () => {
    expect(await searchActiveProducts({ query: 'zolw', categorySlug: 'nie-ma-takiej' })).toEqual([]);
  });
});

/**
 * T-10 and T-11 — `docs/REVIEW-DETAILED.md` BUG-06 and BUG-07, driven
 * through the real write path.
 *
 * This file exists because of what the *pure* tests could not tell anyone.
 * `checkStepAppliesToProductType` has had 30 passing unit tests since P3,
 * and `docs/CHECKLIST.md:81` recorded as a completed item that it "rejects
 * e.g. a THICKNESS selection on WALL_ART". Nothing called it. Every one of
 * those assertions ran green while the running application accepted the
 * opposite — `personalizationText` stored and displayed for products with no
 * `PersonalizationSpec` (so `evaluatePersonalization` returned no issues and
 * **no length limit of any kind applied**), and a `thicknessMm` written into
 * the immutable order snapshot for a wall panel.
 *
 * So every assertion below goes through `applyAddToCart` — a real operation,
 * against real Postgres — and each rejection additionally asserts that
 * **nothing was written**. A check placed after the insert would satisfy a
 * naive "returns ok:false" test while having stored the row.
 *
 * The catalogue is built here rather than taken from the seed, for two
 * reasons: the seeded FLOOR_ELEMENT and KITCHEN_TILE products live in
 * deactivated categories (so `getConfiguratorProductData` returns null and
 * every assertion would pass for the wrong reason), and the seeded catalogue
 * is shared with every other integration file running in parallel. The
 * `test-` slug prefix is what keeps `offered-is-buildable.test.ts` from
 * sweeping these fixtures mid-run.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { MAX_PERSONALIZATION_TEXT_LENGTH } from '@/domain/configuration/input-schema';
import { prisma } from '@/server/db/client';
import { applyAddToCart } from '@/server/operations/cart';
import type { Owner } from '@/server/session/ownership';

const PREFIX = 'test-stepinput-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function guestOwner(sessionToken: string): Owner {
  return { userId: null, sessionToken };
}

type Fixture = Awaited<ReturnType<typeof buildCatalogue>>;

async function buildCatalogue() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Kategoria testowa', descPl: '.', seoTitlePl: '.', seoDescPl: '.' },
  });

  const material = await prisma.material.create({
    data: {
      slug: uid(),
      namePl: 'Materiał testowy',
      family: 'SOLID_WOOD',
      shortDescPl: '.',
      characteristicsPl: '.',
      imageUrl: '/images/test.jpg',
      pricePerM2Grosze: 20_000,
      densityKgPerM3: 700,
      isAvailable: true,
      maxSheetWidthMm: 2000,
      maxSheetHeightMm: 2000,
      minLineWidthUm: 800,
      minDetailSpacingUm: 800,
      minTextHeightUm: 4000,
    },
  });

  const finish = await prisma.finish.create({
    data: {
      slug: uid(),
      namePl: 'Wykończenie testowe',
      kind: 'OIL',
      descPl: '.',
      imageUrl: '/images/test.jpg',
      pricePerM2Grosze: 5_000,
      isAvailable: true,
    },
  });

  const design = await prisma.design.create({
    data: {
      slug: uid(),
      code: uid(),
      namePl: 'Wzór testowy',
      thumbnailUrl: '/images/test.svg',
      previewUrl: '/images/test.svg',
      referenceWidthMm: 400,
      minLineWidthUm: 1000,
      minDetailSpacingUm: 1000,
      recommendedMethod: 'CNC_ENGRAVE',
      minRecommendedWidthMm: 100,
      detailLevel: 2,
      machiningMilliMinutesPerM2: 2500,
      isActive: true,
      rightsStatus: 'APPROVED_COMMERCIAL',
    },
  });

  const product = (typeCode: 'WALL_ART' | 'FLOOR_ELEMENT') =>
    prisma.product.create({
      data: {
        slug: uid(),
        typeCode,
        categoryId: category.id,
        namePl: 'Produkt testowy',
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
        maxWidthMm: 1000,
        minHeightMm: 200,
        maxHeightMm: 1000,
      },
    });

  // WALL_ART has a PERSONALIZATION step and — deliberately — **no**
  // `PersonalizationSpec` row, which is the exact configuration that made
  // engraved text unbounded. FLOOR_ELEMENT has no PERSONALIZATION step at
  // all, and no THICKNESS-free variant, so it covers the other half.
  const [wallArt, floorElement] = await Promise.all([product('WALL_ART'), product('FLOOR_ELEMENT')]);

  await prisma.$transaction([
    prisma.productMaterial.createMany({
      data: [wallArt, floorElement].map((p) => ({ productId: p.id, materialId: material.id })),
    }),
    prisma.productDesign.createMany({
      data: [wallArt, floorElement].map((p) => ({ productId: p.id, designId: design.id })),
    }),
    prisma.materialFinish.create({ data: { materialId: material.id, finishId: finish.id } }),
    // A real offered thickness for the type that HAS a THICKNESS step. This
    // is what makes the FLOOR_ELEMENT control meaningful: without it,
    // `applicableSteps` would narrow THICKNESS away for want of options, and
    // "thickness is accepted where the step exists" would never be
    // exercised — leaving the BUG-06 check free to be too aggressive
    // without any test noticing.
    prisma.productThickness.create({
      data: { productId: floorElement.id, thicknessMm: 18, labelPl: '18 mm' },
    }),
  ]);

  return {
    wallArtSlug: wallArt.slug,
    floorElementSlug: floorElement.slug,
    materialId: material.id,
    designId: design.id,
    finishId: finish.id,
  };
}

let fixture: Fixture;

beforeAll(async () => {
  fixture = await buildCatalogue();
});

afterEach(async () => {
  const carts = await prisma.cart.findMany({
    where: { sessionToken: { startsWith: PREFIX } },
    select: { id: true },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((c) => c.id) } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

afterAll(async () => {
  await prisma.productDesign.deleteMany({ where: { design: { slug: { startsWith: PREFIX } } } });
  await prisma.productMaterial.deleteMany({ where: { material: { slug: { startsWith: PREFIX } } } });
  await prisma.materialFinish.deleteMany({ where: { finish: { slug: { startsWith: PREFIX } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.design.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.finish.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

/** A complete, genuinely orderable configuration for the given product. */
function validFor(slug: 'wallArt' | 'floorElement', overrides: Partial<Selections> = {}): Selections {
  return {
    ...EMPTY_SELECTIONS,
    designId: fixture.designId,
    materialId: fixture.materialId,
    finishId: fixture.finishId,
    widthMm: 400,
    heightMm: 400,
    ...(slug === 'floorElement' ? { thicknessMm: 18 } : {}),
    ...overrides,
  };
}

async function add(
  slug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[] = [],
): Promise<{ ok: boolean; configurations: number }> {
  const sessionToken = uid();
  const result = await applyAddToCart(
    guestOwner(sessionToken),
    sessionToken,
    slug,
    selections,
    acknowledgedWarnings,
    1,
  );
  const configurations = await prisma.configuration.count({ where: { sessionToken } });
  return { ok: result.ok, configurations };
}

describe('the control: these configurations really are orderable', () => {
  // Without this, every assertion below could pass because the fixture is
  // broken rather than because the rule works.
  it('accepts a valid WALL_ART configuration', async () => {
    expect(await add(fixture.wallArtSlug, validFor('wallArt'))).toEqual({ ok: true, configurations: 1 });
  });

  it('accepts a valid FLOOR_ELEMENT configuration', async () => {
    expect(await add(fixture.floorElementSlug, validFor('floorElement'))).toEqual({
      ok: true,
      configurations: 1,
    });
  });
});

describe('BUG-06 — a selection for a step the product type does not have', () => {
  it('rejects thicknessMm on a WALL_ART, and stores nothing', async () => {
    // The audit's own example, and the one `docs/CHECKLIST.md:81` claimed
    // was already enforced.
    expect(await add(fixture.wallArtSlug, validFor('wallArt', { thicknessMm: 999 }))).toEqual({
      ok: false,
      configurations: 0,
    });
  });

  it('rejects personalizationText on a FLOOR_ELEMENT, and stores nothing', async () => {
    expect(
      await add(fixture.floorElementSlug, validFor('floorElement', { personalizationText: 'Ala ma kota' })),
    ).toEqual({ ok: false, configurations: 0 });
  });

  it('rejects a fontId on a FLOOR_ELEMENT', async () => {
    expect(await add(fixture.floorElementSlug, validFor('floorElement', { fontId: 'anything' }))).toEqual({
      ok: false,
      configurations: 0,
    });
  });

  it('rejects an installationVariant on a WALL_ART', async () => {
    expect(
      await add(fixture.wallArtSlug, validFor('wallArt', { installationVariant: 'FULL_WALL' })),
    ).toEqual({ ok: false, configurations: 0 });
  });

  it('rejects a customUploadId on a WALL_ART', async () => {
    expect(await add(fixture.wallArtSlug, validFor('wallArt', { customUploadId: 'anything' }))).toEqual({
      ok: false,
      configurations: 0,
    });
  });
});

describe('BUG-07 — engraved text on a product with no PersonalizationSpec', () => {
  // The hole this closes: `evaluatePersonalization` returns
  // `{ issues: [], fontRequired: false }` when the spec row is missing, so
  // before the schema there was no length limit, no glyph coverage check
  // and no content validation of any kind on text that is stored, shown in
  // the cart, and copied into the immutable order snapshot.
  it('accepts text up to the hard ceiling', async () => {
    const text = 'x'.repeat(MAX_PERSONALIZATION_TEXT_LENGTH);
    expect(await add(fixture.wallArtSlug, validFor('wallArt', { personalizationText: text }))).toEqual({
      ok: true,
      configurations: 1,
    });
  });

  it('rejects text one character past it, and stores nothing', async () => {
    const text = 'x'.repeat(MAX_PERSONALIZATION_TEXT_LENGTH + 1);
    expect(await add(fixture.wallArtSlug, validFor('wallArt', { personalizationText: text }))).toEqual({
      ok: false,
      configurations: 0,
    });
  });

  it('rejects a megabyte of text', async () => {
    expect(
      await add(fixture.wallArtSlug, validFor('wallArt', { personalizationText: 'x'.repeat(1_000_000) })),
    ).toEqual({ ok: false, configurations: 0 });
  });
});

describe('BUG-07 — acknowledgedWarnings', () => {
  it('accepts a real feasibility code and stores it', async () => {
    const sessionToken = uid();
    const result = await applyAddToCart(
      guestOwner(sessionToken),
      sessionToken,
      fixture.wallArtSlug,
      validFor('wallArt'),
      ['NATURAL_VARIATION'],
      1,
    );

    expect(result.ok).toBe(true);
    const stored = await prisma.configuration.findFirst({
      where: { sessionToken },
      select: { acknowledgedWarnings: true },
    });
    expect(stored?.acknowledgedWarnings).toEqual(['NATURAL_VARIATION']);
  });

  it('rejects a code that does not exist, and stores nothing', async () => {
    expect(await add(fixture.wallArtSlug, validFor('wallArt'), ['NOT_A_REAL_CODE'])).toEqual({
      ok: false,
      configurations: 0,
    });
  });

  it('rejects an arbitrary string used as storage', async () => {
    // A `String[]` column written straight through is a cheap
    // storage-amplification vector.
    expect(await add(fixture.wallArtSlug, validFor('wallArt'), ['x'.repeat(100_000)])).toEqual({
      ok: false,
      configurations: 0,
    });
  });

  it('rejects more entries than any configuration can produce', async () => {
    const many = Array.from({ length: 500 }, () => 'NATURAL_VARIATION');
    expect(await add(fixture.wallArtSlug, validFor('wallArt'), many)).toEqual({
      ok: false,
      configurations: 0,
    });
  });
});

describe('BUG-07 — malformed arguments are a typed rejection, not a 500', () => {
  it.each([
    ['a number where an id belongs', { designId: 42 }],
    ['a string where a number belongs', { widthMm: '400' }],
    ['a non-integer dimension', { heightMm: 400.5 }],
    ['an object where a string belongs', { personalizationText: { length: 1 } }],
  ])('rejects %s', async (_label, override) => {
    // Cast: the whole point is that a caller bypassing TypeScript — which
    // any HTTP client does — cannot reach Prisma with these values.
    const selections = { ...validFor('wallArt'), ...override } as unknown as Selections;

    await expect(add(fixture.wallArtSlug, selections)).resolves.toEqual({ ok: false, configurations: 0 });
  });
});

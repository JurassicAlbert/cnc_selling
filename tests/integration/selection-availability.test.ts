import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Selections } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { applyAddToCart } from '@/server/operations/cart';
import { findCartForRequest } from '@/server/repositories/cart';
import type { Owner } from '@/server/session/ownership';

/**
 * `docs/REVIEW-DETAILED.md` SEC-03.
 *
 * `domain/compatibility/resolve.ts` implements §7.2's rules correctly and
 * has 17 unit tests. It was called only from `resolve-options.ts`, whose
 * output decides what the UI *renders* — the write path
 * (`priceAndValidateSelections`, shared by add-to-cart, cart edit and
 * checkout re-pricing) resolved material/design/finish by plain map lookup
 * against maps built with no `where` clause at all.
 *
 * So every one of these assertions ran green as a unit test while the
 * application accepted the opposite. That is the point of testing through
 * `applyAddToCart` here rather than against `availableDesigns`: the unit
 * tests specify the rule, these prove something enforces it.
 *
 * `Design.rightsStatus` in particular is not a preference. The schema
 * comment calls it enforcement of brief §12 — that nothing is assumed free
 * to reproduce — "by a query filter, not by discipline". A RESTRICTED
 * design reaching an order is a copyright exposure, not a UX slip.
 */

const PREFIX = 'test-availability-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function guestOwner(sessionToken: string): Owner {
  return { userId: null, sessionToken };
}

type Fixture = Awaited<ReturnType<typeof buildCatalogue>>;

/**
 * A self-contained catalogue rather than a mutated seed row: these tests
 * deactivate things, and the seeded catalogue is shared with every other
 * integration file running in parallel.
 */
async function buildCatalogue() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Kategoria testowa', descPl: '.', seoTitlePl: '.', seoDescPl: '.' },
  });

  const material = (available: boolean) =>
    prisma.material.create({
      data: {
        slug: uid(),
        namePl: 'Materiał testowy',
        family: 'SOLID_WOOD',
        shortDescPl: '.',
        characteristicsPl: '.',
        imageUrl: '/images/test.jpg',
        pricePerM2Grosze: 20_000,
        densityKgPerM3: 700,
        isAvailable: available,
        maxSheetWidthMm: 2000,
        maxSheetHeightMm: 2000,
        minLineWidthUm: 800,
        minDetailSpacingUm: 800,
        minTextHeightUm: 4000,
      },
    });

  const finish = (available: boolean) =>
    prisma.finish.create({
      data: {
        slug: uid(),
        namePl: 'Wykończenie testowe',
        kind: 'OIL',
        descPl: '.',
        imageUrl: '/images/test.jpg',
        pricePerM2Grosze: 5_000,
        isAvailable: available,
      },
    });

  const design = (overrides: { isActive?: boolean; rightsStatus?: 'APPROVED_COMMERCIAL' | 'REQUIRES_PERMISSION' | 'RESTRICTED' | 'PUBLIC_DOMAIN' } = {}) =>
    prisma.design.create({
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
        isActive: overrides.isActive ?? true,
        rightsStatus: overrides.rightsStatus ?? 'APPROVED_COMMERCIAL',
      },
    });

  const [availableMaterial, unavailableMaterial, narrowingMaterial] = await Promise.all([
    material(true),
    material(false),
    material(true),
  ]);
  const [availableFinish, unavailableFinish] = await Promise.all([finish(true), finish(false)]);
  const [sellableDesign, inactiveDesign, unapprovedDesign, restrictedDesign, narrowedDesign] = await Promise.all([
    design(),
    design({ isActive: false }),
    design({ rightsStatus: 'REQUIRES_PERMISSION' }),
    design({ rightsStatus: 'RESTRICTED' }),
    design(),
  ]);

  const product = await prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
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

  await prisma.$transaction([
    prisma.productMaterial.createMany({
      data: [availableMaterial, unavailableMaterial, narrowingMaterial].map((m) => ({
        productId: product.id,
        materialId: m.id,
      })),
    }),
    prisma.materialFinish.createMany({
      data: [availableMaterial, unavailableMaterial, narrowingMaterial].flatMap((m) =>
        [availableFinish, unavailableFinish].map((f) => ({ materialId: m.id, finishId: f.id })),
      ),
    }),
    prisma.productDesign.createMany({
      data: [sellableDesign, inactiveDesign, unapprovedDesign, restrictedDesign, narrowedDesign].map((d) => ({
        productId: product.id,
        designId: d.id,
      })),
    }),
    // This design is offered only on `narrowingMaterial` — §7.2's
    // "DesignMaterial if narrowed". No rows would mean "every material the
    // product allows", which is a genuinely different thing.
    prisma.designMaterial.create({ data: { designId: narrowedDesign.id, materialId: narrowingMaterial.id } }),
  ]);

  return {
    productSlug: product.slug,
    availableMaterialId: availableMaterial.id,
    unavailableMaterialId: unavailableMaterial.id,
    narrowingMaterialId: narrowingMaterial.id,
    availableFinishId: availableFinish.id,
    unavailableFinishId: unavailableFinish.id,
    sellableDesignId: sellableDesign.id,
    inactiveDesignId: inactiveDesign.id,
    unapprovedDesignId: unapprovedDesign.id,
    restrictedDesignId: restrictedDesign.id,
    narrowedDesignId: narrowedDesign.id,
  };
}

let fixture: Fixture;

function selections(overrides: Partial<Selections> = {}): Selections {
  return {
    designId: fixture.sellableDesignId,
    customUploadId: null,
    materialId: fixture.availableMaterialId,
    widthMm: 400,
    heightMm: 400,
    thicknessMm: null,
    finishId: fixture.availableFinishId,
    installationVariant: null,
    personalizationText: null,
    fontId: null,
    ...overrides,
  };
}

beforeAll(async () => {
  fixture = await buildCatalogue();
});

afterEach(async () => {
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.analyticsEvent.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

// Products cascade to their own ProductMaterial/ProductDesign rows, and
// designs to their DesignMaterial rows, so the order below is the only one
// the foreign keys permit.
afterAll(async () => {
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.design.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.materialFinish.deleteMany({ where: { material: { slug: { startsWith: PREFIX } } } });
  await prisma.finish.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('the control — a genuinely sellable configuration still works', () => {
  it('prices, and adds to the cart', async () => {
    const outcome = await priceAndValidateSelections(fixture.productSlug, selections());
    expect(outcome.ok).toBe(true);

    const sessionToken = uid();
    const result = await applyAddToCart(guestOwner(sessionToken), sessionToken, fixture.productSlug, selections(), [], 1);

    expect(result.ok).toBe(true);
    expect((await findCartForRequest({ userId: null, sessionToken })).items).toHaveLength(1);
  });
});

describe('server-side rejection of unsellable selections (SEC-03)', () => {
  const cases: ReadonlyArray<{ readonly name: string; readonly build: () => Selections }> = [
    { name: 'a deactivated design', build: () => selections({ designId: fixture.inactiveDesignId }) },
    { name: 'a design that is catalogued but not cleared for sale (REQUIRES_PERMISSION)', build: () => selections({ designId: fixture.unapprovedDesignId }) },
    { name: 'a design explicitly marked RESTRICTED', build: () => selections({ designId: fixture.restrictedDesignId }) },
    { name: 'a material that is no longer available', build: () => selections({ materialId: fixture.unavailableMaterialId }) },
    { name: 'a finish that is no longer available', build: () => selections({ finishId: fixture.unavailableFinishId }) },
    {
      name: 'a design paired with a material its own DesignMaterial rows exclude',
      build: () => selections({ designId: fixture.narrowedDesignId, materialId: fixture.availableMaterialId }),
    },
    { name: 'a thickness this product does not offer at all', build: () => selections({ thicknessMm: 999 }) },
    { name: 'a design id that belongs to no product', build: () => selections({ designId: 'made-up-design-id' }) },
    { name: 'a material id that belongs to no product', build: () => selections({ materialId: 'made-up-material-id' }) },
  ];

  for (const testCase of cases) {
    it(`refuses to price ${testCase.name}`, async () => {
      const outcome = await priceAndValidateSelections(fixture.productSlug, testCase.build());
      expect(outcome.ok).toBe(false);
    });

    it(`refuses to add ${testCase.name} to the cart`, async () => {
      const sessionToken = uid();

      const result = await applyAddToCart(guestOwner(sessionToken), sessionToken, fixture.productSlug, testCase.build(), [], 1);

      expect(result.ok).toBe(false);
      expect((await findCartForRequest({ userId: null, sessionToken })).items).toHaveLength(0);
      // Nothing may be persisted on the way to the refusal, either — a
      // rejected configuration that still leaves a `Configuration` row
      // would show up as a saved project the customer never made.
      expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(0);
    });
  }

  it('says specifically that an option is unavailable, not just "invalid"', async () => {
    const sessionToken = uid();

    const result = await applyAddToCart(
      guestOwner(sessionToken),
      sessionToken,
      fixture.productSlug,
      selections({ designId: fixture.restrictedDesignId }),
      [],
      1,
    );

    expect(result).toEqual({ ok: false, code: 'OPTION_UNAVAILABLE' });
  });

  it('allows the narrowed design on the one material it is actually offered for', async () => {
    const outcome = await priceAndValidateSelections(
      fixture.productSlug,
      selections({ designId: fixture.narrowedDesignId, materialId: fixture.narrowingMaterialId }),
    );

    expect(outcome.ok).toBe(true);
  });
});

describe('a configuration that was valid when saved, and is not any more', () => {
  /**
   * The realistic path, and the reason this is not only a "crafted request"
   * problem. Staff retire a pattern — the panel's whole delete story is
   * deactivate-not-destroy — and a customer is still holding a saved
   * project, a shared link or a bookmark from before.
   */
  it('stops being addable once staff deactivate its design', async () => {
    const sessionToken = uid();
    const design = await prisma.design.create({
      data: {
        slug: uid(),
        code: uid(),
        namePl: 'Wzór do wycofania',
        thumbnailUrl: '/images/test.svg',
        previewUrl: '/images/test.svg',
        referenceWidthMm: 400,
        minLineWidthUm: 1000,
        minDetailSpacingUm: 1000,
        recommendedMethod: 'CNC_ENGRAVE',
        minRecommendedWidthMm: 100,
        detailLevel: 2,
        machiningMilliMinutesPerM2: 2500,
        rightsStatus: 'APPROVED_COMMERCIAL',
      },
    });
    await prisma.productDesign.create({
      data: { productId: (await prisma.product.findUniqueOrThrow({ where: { slug: fixture.productSlug } })).id, designId: design.id },
    });
    const saved = selections({ designId: design.id });

    expect((await applyAddToCart(guestOwner(sessionToken), sessionToken, fixture.productSlug, saved, [], 1)).ok).toBe(true);

    await prisma.design.update({ where: { id: design.id }, data: { isActive: false } });

    const afterRetirement = await applyAddToCart(guestOwner(uid()), uid(), fixture.productSlug, saved, [], 1);
    expect(afterRetirement).toEqual({ ok: false, code: 'OPTION_UNAVAILABLE' });
  });
});

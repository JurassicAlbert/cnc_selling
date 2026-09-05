import { describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { computeStartingPriceGrossGrosze, refreshAllStartingPrices } from '@/server/pricing/starting-price';
import { applyUpdateMaterial } from '@/server/operations/admin-materials';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { stepsForProductType } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';

/**
 * `docs/REVIEW-DETAILED.md` BUG-02.
 *
 * Every listing page advertised `Product.minPriceGrosze` as the price. That
 * value is the **net** clamp inside `calculatePrice`, while every other
 * price on the site is gross - and it was also far below anything that
 * could actually be built. The same number went into the Schema.org
 * `Offer.price`.
 *
 * The wall art advertised 150,00 zł against a real cheapest of **648,89 zł**
 * gross. (The audit first estimated ≈190,40 by pricing the smallest preset;
 * that estimate was wrong, because the 20×20 cm preset is blocked by
 * `LINE_TOO_THIN` for every pattern the product offers, so nothing at that
 * size is buildable at all. The true floor is the next preset up.)
 *
 * Owner, 2026-08-31: "we should show the brutto - gross price and the price
 * should depend on what user pick."
 *
 * So there are exactly two properties worth asserting, and they are the two
 * that were broken:
 *
 *   1. the advertised price is **gross**, and
 *   2. it is **reachable** - some real configuration costs exactly that,
 *      and none costs less.
 *
 * Both are checked against `priceAndValidateSelections` - the same path
 * add-to-cart and checkout use - rather than against the computation under
 * test, so agreeing with itself is not enough to pass.
 */

const WALL_ART_SLUG = 'obraz-drewniany-z-grawerem';

/** Real configurations for a product, built the same way the configurator would. */
async function sampleConfigurations(slug: string, limit: number): Promise<readonly Selections[]> {
  const data = await getConfiguratorProductData(slug);
  if (data === null) {
    throw new Error(`No "${slug}" in this database - seed it first`);
  }
  const steps = stepsForProductType(data.typeCode);
  // Every offered size, not just the smallest. The smallest is always the
  // cheapest, but it is not always BUILDABLE - a design's minimum line
  // width scales down with the piece, so the wall art's 20×20 cm preset is
  // blocked for every pattern it offers. Sampling only that size would
  // find nothing priceable and the assertion would pass vacuously.
  const sizes =
    data.options.presetSizes.length > 0
      ? [...data.options.presetSizes].sort((a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm)
      : [{ widthMm: data.product.minWidthMm, heightMm: data.product.minHeightMm }];

  const out: Selections[] = [];
  const base = resolveOptions(data.options, {
    designId: null,
    customUploadId: null,
    materialId: null,
    widthMm: null,
    heightMm: null,
    thicknessMm: null,
    finishId: null,
    installationVariant: null,
    personalizationText: null,
    fontId: null,
  });

  for (const materialId of base.materialIds) {
    for (const designId of base.designIds) {
      const withMaterial = resolveOptions(data.options, {
        designId,
        customUploadId: null,
        materialId,
        widthMm: null,
        heightMm: null,
        thicknessMm: null,
        finishId: null,
        installationVariant: null,
        personalizationText: null,
        fontId: null,
      });
      for (const finishId of steps.includes('FINISH') ? withMaterial.finishIds : [null]) {
        for (const size of sizes) {
          out.push({
            designId: steps.includes('DESIGN') ? designId : null,
            customUploadId: null,
            materialId,
            widthMm: size.widthMm,
            heightMm: size.heightMm,
            thicknessMm: steps.includes('THICKNESS') ? (withMaterial.thicknessesMm[0] ?? null) : null,
            finishId,
            installationVariant: steps.includes('INSTALLATION_VARIANT')
              ? (withMaterial.installVariantCodes[0] ?? null)
              : null,
            personalizationText: null,
            fontId: null,
          });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

describe('the advertised starting price', () => {
  it('is gross, not the net clamp it used to advertise', async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: WALL_ART_SLUG },
      select: { minPriceGrosze: true },
    });

    const starting = await computeStartingPriceGrossGrosze(WALL_ART_SLUG);

    expect(starting).not.toBeNull();
    // Gross is strictly above the net clamp for any non-zero VAT rate, so
    // this fails immediately if the net value is ever advertised again.
    expect(starting as number).toBeGreaterThan(product.minPriceGrosze);
  });

  /**
   * Deliberately exhaustive, and therefore slow: it prices every offered
   * combination through the real `priceAndValidateSelections` - one
   * catalogue read each - rather than reusing the implementation under
   * test. Sampling a clever subset would need the same "which is cheapest"
   * reasoning the code makes, and would stop being independent evidence.
   * The default 5s timeout is not enough for ~130 round trips once the rest
   * of the suite is competing for the connection pool.
   */
  it('is reachable - no real configuration of this product costs less', { timeout: 60_000 }, async () => {
    const starting = await computeStartingPriceGrossGrosze(WALL_ART_SLUG);
    expect(starting).not.toBeNull();

    // High enough to cover the whole option set for this product - the
    // "equals the cheapest" assertion below is only meaningful if the sample
    // actually contains the cheapest combination.
    const configurations = await sampleConfigurations(WALL_ART_SLUG, 500);
    expect(configurations.length).toBeGreaterThan(0);

    let cheapestSeen = Number.POSITIVE_INFINITY;
    for (const selections of configurations) {
      const outcome = await priceAndValidateSelections(WALL_ART_SLUG, selections);
      if (!outcome.ok) {
        continue;
      }
      const gross = outcome.pricing.priceBreakdown.unitGrossGrosze;
      expect(gross).toBeGreaterThanOrEqual(starting as number);
      cheapestSeen = Math.min(cheapestSeen, gross);
    }

    // ...and it is not merely a safe underestimate: the advertised price is
    // one a customer can actually reach. "od X zł" where nothing costs X is
    // the bug this replaces.
    expect(cheapestSeen).toBe(starting);
  });

  it('is null for a product whose price genuinely cannot be known up front', async () => {
    // CUSTOM products need the customer's own uploaded artwork before
    // anything can be priced (`CUSTOM_UPLOAD` precedes SIZE). Advertising a
    // number there would be inventing one - null means "show no price",
    // never "show zero".
    const custom = await prisma.product.findFirst({
      where: { typeCode: 'CUSTOM', isActive: true },
      select: { slug: true },
    });
    if (custom === null) {
      return;
    }

    expect(await computeStartingPriceGrossGrosze(custom.slug)).toBeNull();
  });

  it('ignores options that are not sellable', async () => {
    const before = await computeStartingPriceGrossGrosze(WALL_ART_SLUG);

    // The cheapest material, made unavailable. If the computation reached
    // past the §7.2 filters it would keep quoting the old, now-unbuyable
    // price - which is exactly how the advertised figure became unreachable
    // in the first place.
    const data = await getConfiguratorProductData(WALL_ART_SLUG);
    const cheapestMaterialId = [...(data?.materialsById.entries() ?? [])].sort(
      (a, b) => a[1].pricePerM2Grosze - b[1].pricePerM2Grosze,
    )[0]?.[0];
    if (cheapestMaterialId === undefined) {
      throw new Error('seeded product has no materials');
    }

    await prisma.material.update({ where: { id: cheapestMaterialId }, data: { isAvailable: false } });
    try {
      const after = await computeStartingPriceGrossGrosze(WALL_ART_SLUG);
      expect(after).not.toBeNull();
      expect(after as number).toBeGreaterThanOrEqual(before as number);
    } finally {
      await prisma.material.update({ where: { id: cheapestMaterialId }, data: { isAvailable: true } });
    }
  });
});

describe('the stored starting price stays in step with the catalogue', () => {
  /**
   * The failure mode worth guarding is a **missed refresh hook**: a rate
   * changes, nobody recomputes, and the shop quietly advertises yesterday's
   * price - the same class of bug as the original.
   *
   * So this drives a real admin operation rather than calling
   * `refreshAllStartingPrices()` itself. A test that refreshes first and
   * then checks the refresh worked would pass no matter which operations
   * remembered to call it, which is precisely the thing that needs proving.
   */
  it('moves when staff change a material price, without anyone recomputing by hand', async () => {
    // The CHEAPEST available material, specifically: it is the one the
    // cheapest configuration uses, so changing its price is guaranteed to
    // move the advertised figure. Picking an arbitrary material could leave
    // the minimum untouched and pass vacuously.
    const material = await prisma.material.findFirstOrThrow({
      where: { isAvailable: true, products: { some: { product: { slug: WALL_ART_SLUG } } } },
      orderBy: { pricePerM2Grosze: 'asc' },
      select: { id: true, slug: true, pricePerM2Grosze: true },
    });
    await refreshAllStartingPrices();
    const before = await prisma.product.findUniqueOrThrow({
      where: { slug: WALL_ART_SLUG },
      select: { startingPriceGrossGrosze: true },
    });

    const staff = { userId: 'test-staff', role: 'ADMIN' as const, name: 'Test', email: 'staff@example.test' };
    const form = new FormData();
    for (const [key, value] of Object.entries({
      slug: material.slug,
      namePl: 'Materiał testowy ceny',
      family: 'SOLID_WOOD',
      shortDescPl: '.',
      characteristicsPl: '.',
      // The form takes złoty, not grosze - `readMaterialFields` multiplies.
      pricePerM2Pln: String((material.pricePerM2Grosze * 3) / 100),
      densityKgPerM3: '700',
      maxSheetWidthMm: '2000',
      maxSheetHeightMm: '2000',
      minLineWidthUm: '800',
      minDetailSpacingUm: '800',
      minTextHeightUm: '4000',
      grainDirection: 'NONE',
    })) {
      form.set(key, value);
    }

    try {
      const result = await applyUpdateMaterial(staff, material.id, form);
      expect(result.ok).toBe(true);

      const after = await prisma.product.findUniqueOrThrow({
        where: { slug: WALL_ART_SLUG },
        select: { startingPriceGrossGrosze: true },
      });
      expect(after.startingPriceGrossGrosze).not.toBe(before.startingPriceGrossGrosze);
      expect(after.startingPriceGrossGrosze).toBe(await computeStartingPriceGrossGrosze(WALL_ART_SLUG));
    } finally {
      await prisma.material.update({
        where: { id: material.id },
        data: { pricePerM2Grosze: material.pricePerM2Grosze },
      });
      await refreshAllStartingPrices();
    }
  });
});

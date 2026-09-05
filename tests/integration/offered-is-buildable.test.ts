import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTIONS, stepsForProductType } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import type { ConfiguratorProductData } from '@/server/repositories/configurator';
import { applyAddToCart } from '@/server/operations/cart';
import { findCartForRequest } from '@/server/repositories/cart';

/**
 * **The invariant, in the owner's own words (2026-08-31): "there shouldn't
 * be cases where we allow something but its blocked by system - this is
 * logical issue."**
 *
 * Every option this shop offers must be buildable. An option that is
 * presented, priced and selectable but then refused at add-to-cart is not a
 * safety feature - it is a dead end that only a customer discovers, and it
 * cost this project two entirely unsellable products (`docs/AI-CHECKLIST.md`
 * BUG-35: the bracelet was 0-of-132 buildable, the loft stool 0-of-792,
 * both live on the storefront).
 *
 * That went unnoticed because nothing asserted it. `ARCHITECTURE.md`'s test
 * matrix has rows for pricing, dimensions and feasibility in isolation, and
 * none for "can this product actually be ordered". This is that row.
 *
 * The sweep uses `priceConfiguration` - the same function
 * `priceAndValidateSelections` calls - rather than going through the
 * database once per combination, because exhaustive means ~1500
 * combinations. One representative configuration per product is then driven
 * all the way through `applyAddToCart`, so the cheap sweep is anchored to
 * the real boundary rather than trusted on its own.
 */

const PREFIX = 'test-offered-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

type Combination = { readonly selections: Selections; readonly label: string };

/** Every combination the configurator would actually let a customer reach. */
function offeredCombinations(data: ConfiguratorProductData): readonly Combination[] {
  const steps = stepsForProductType(data.typeCode);
  const base = resolveOptions(data.options, EMPTY_SELECTIONS);
  const sizes =
    data.options.presetSizes.length > 0
      ? data.options.presetSizes.map((p) => ({ widthMm: p.widthMm, heightMm: p.heightMm, label: p.labelPl }))
      : [
          {
            widthMm: data.product.minWidthMm,
            heightMm: data.product.minHeightMm,
            label: 'minimum',
          },
        ];

  const out: Combination[] = [];
  for (const materialId of base.materialIds) {
    const withMaterial = resolveOptions(data.options, { ...EMPTY_SELECTIONS, materialId });
    // `[null]` both when the step does not apply to this product type AND
    // when it applies but the product offers nothing for it - the second
    // case is a real configuration (unfinished gres has no finish to pick),
    // and `applicableSteps` in `validate-and-price.ts` treats it the same
    // way. Iterating an empty list instead would silently produce zero
    // combinations and let this test pass by checking nothing.
    const orNone = <T>(applies: boolean, values: readonly T[]): ReadonlyArray<T | null> =>
      applies && values.length > 0 ? values : [null];

    const designIds = orNone(steps.includes('DESIGN'), withMaterial.designIds);
    const finishIds = orNone(steps.includes('FINISH'), withMaterial.finishIds);
    const thicknesses = orNone(steps.includes('THICKNESS'), withMaterial.thicknessesMm);
    const variants = orNone(steps.includes('INSTALLATION_VARIANT'), withMaterial.installVariantCodes);

    for (const designId of designIds) {
      for (const finishId of finishIds) {
        for (const thicknessMm of thicknesses) {
          for (const installationVariant of variants) {
            for (const size of sizes) {
              out.push({
                selections: {
                  ...EMPTY_SELECTIONS,
                  designId,
                  materialId,
                  finishId,
                  thicknessMm,
                  installationVariant,
                  widthMm: size.widthMm,
                  heightMm: size.heightMm,
                },
                label: `${size.label} · material ${materialId}${designId === null ? '' : ` · design ${designId}`}`,
              });
            }
          }
        }
      }
    }
  }
  return out;
}

function blockedReason(data: ConfiguratorProductData, selections: Selections): string | null {
  const material = selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
  if (material === null) {
    return 'material not resolvable';
  }
  const result = priceConfiguration(
    {
      product: data.product,
      material,
      design: selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null),
      finish: selections.finishId === null ? null : (data.finishesById.get(selections.finishId) ?? null),
      thickness: selections.thicknessMm === null ? null : (data.thicknessesByMm.get(selections.thicknessMm) ?? null),
      installationVariant:
        selections.installationVariant === null
          ? null
          : (data.installVariantsByCode.get(selections.installationVariant) ?? null),
      personalizationSpec: data.personalizationSpec,
      font: null,
      machine: data.machine,
      pricing: data.pricing,
    },
    selections,
    1,
  );

  if (result.status !== 'priced') {
    return `status=${result.status}`;
  }
  if (result.blockingError) {
    const errors = result.feasibility.filter((f) => f.severity === 'error').map((f) => f.code);
    return `blocked by ${errors.join(', ') || 'personalization'}`;
  }
  return null;
}

/**
 * The catalogue this invariant is about: what the shop actually offers.
 *
 * `slug: { not: { startsWith: 'test-' } }` is not tidiness - it is
 * correctness under parallel test files. Vitest runs files concurrently, and
 * several of them (`selection-availability.test.ts` above all) create their
 * own active products and tear them down again. This test enumerates
 * *whatever is active at this moment*, so without the filter it picks up
 * another file's fixture, and by the time it asks for that product's
 * configurator data the other file has deleted it - a failure reading
 * `test-availability-<uuid>: no configurator data`, which says nothing about
 * the shop's catalogue and appears only sometimes. (Observed on 2026-08-31,
 * once in four full-suite runs.)
 *
 * Every fixture-creating file in this suite already prefixes its rows
 * `test-`; a real product slug is Polish and customer-facing, so the two
 * namespaces cannot collide.
 */
async function activeProductSlugs(): Promise<readonly string[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
      slug: { not: { startsWith: 'test-' } },
    },
    select: { slug: true },
    orderBy: { slug: 'asc' },
  });
  return products.map((p) => p.slug);
}

describe('every option the shop offers is buildable', () => {
  it('has products to check at all', async () => {
    expect((await activeProductSlugs()).length).toBeGreaterThan(0);
  });

  it('never presents a combination that the system then refuses', { timeout: 60_000 }, async () => {
    const slugs = await activeProductSlugs();
    const failures: string[] = [];

    for (const slug of slugs) {
      const data = await getConfiguratorProductData(slug);
      if (data === null) {
        failures.push(`${slug}: no configurator data`);
        continue;
      }
      // A CUSTOM product genuinely has nothing to offer until the customer
      // uploads artwork - it is not "offering something blocked", it is
      // waiting for an input. Its own step list says so.
      if (stepsForProductType(data.typeCode).includes('CUSTOM_UPLOAD')) {
        continue;
      }

      const combinations = offeredCombinations(data);
      if (combinations.length === 0) {
        failures.push(`${slug}: offers no configurable combination at all`);
        continue;
      }

      const blocked = combinations
        .map((c) => ({ label: c.label, reason: blockedReason(data, c.selections) }))
        .filter((r): r is { label: string; reason: string } => r.reason !== null);

      if (blocked.length > 0) {
        failures.push(
          `${slug}: ${blocked.length}/${combinations.length} offered combinations are blocked - e.g. ${blocked[0]?.label} (${blocked[0]?.reason})`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('lets a real customer actually add each product to the cart', { timeout: 60_000 }, async () => {
    const slugs = await activeProductSlugs();
    const failures: string[] = [];

    for (const slug of slugs) {
      const data = await getConfiguratorProductData(slug);
      if (data === null || stepsForProductType(data.typeCode).includes('CUSTOM_UPLOAD')) {
        continue;
      }
      const first = offeredCombinations(data)[0];
      if (first === undefined) {
        failures.push(`${slug}: nothing offered`);
        continue;
      }

      const sessionToken = uid();
      const result = await applyAddToCart(
        { userId: null, sessionToken },
        sessionToken,
        slug,
        first.selections,
        [],
        1,
      );
      if (!result.ok) {
        failures.push(`${slug}: applyAddToCart refused with ${result.code}`);
        continue;
      }
      const cart = await findCartForRequest({ userId: null, sessionToken });
      if (cart.items.length !== 1) {
        failures.push(`${slug}: cart has ${cart.items.length} items after adding one`);
      }

      await prisma.cartItem.deleteMany({ where: { cart: { sessionToken } } });
      await prisma.cart.deleteMany({ where: { sessionToken } });
      await prisma.configuration.deleteMany({ where: { sessionToken } });
      await prisma.analyticsEvent.deleteMany({ where: { sessionToken } });
    }

    expect(failures).toEqual([]);
  });
});

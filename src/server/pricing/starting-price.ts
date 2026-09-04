/**
 * The "od X zł" a customer sees before they configure anything.
 *
 * `docs/REVIEW-DETAILED.md` BUG-02: every listing page used to advertise
 * `Product.minPriceGrosze`, which is the **net** clamp inside
 * `calculatePrice` - while every other price on the site is gross - and
 * which for several products was also below anything that could actually be
 * built. The wall art advertised 150,00 zł against a real cheapest of
 * ≈190,40 zł gross, and the same figure went into the Schema.org
 * `Offer.price`.
 *
 * Owner, 2026-08-31: "we should show the brutto - gross price and the price
 * should depend on what user pick." So this computes the **cheapest
 * configuration a customer could actually buy**, gross - the real floor of
 * what the configurator will then quote as they pick.
 *
 * **Stored, not computed per request.** A category page renders many
 * products, and each computation needs that product's whole option
 * graph; doing it inline would put a heavy query per card on the hottest
 * pages in the shop. `Product.startingPriceGrossGrosze` holds the answer
 * and `refreshAllStartingPrices()` recomputes it after anything that can
 * move a price. A stale stored value would be the original bug wearing a
 * different hat, so `tests/integration/starting-price.test.ts` asserts that
 * every active product's stored value still equals a freshly computed one -
 * a missed refresh hook fails the suite rather than quietly mispricing the
 * catalogue.
 *
 * `null` means "we genuinely cannot know yet", and every caller must render
 * no price rather than zero. That is the honest answer for a `CUSTOM`
 * product, whose `CUSTOM_UPLOAD` step comes before `SIZE`: nothing can be
 * priced until the customer's own artwork exists.
 */

import { stepsForProductType } from '@/domain/configuration/steps';
import type { Selections, StepCode } from '@/domain/configuration/steps';
import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/logging/logger';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import type { ConfiguratorProductData } from '@/server/repositories/configurator';

/**
 * Every size the product actually offers, smallest first.
 *
 * The cheapest size is always the smallest - every component that varies
 * with size (material, machining, finish, packaging tier, module surcharge)
 * grows with area. But cheapest is not the same as **buildable**: a small
 * panel can fail feasibility outright, because a design's minimum line
 * width is declared at its reference width and scales down with the piece.
 * The seeded wall art is exactly that case - its 20×20 cm preset cannot
 * carry its own patterns, which is also why `computeDefaultSelections`
 * opens the configurator on the middle preset rather than the first.
 *
 * So this sweeps sizes rather than assuming one, and the caller keeps the
 * cheapest combination that genuinely prices. Preset lists are short.
 */
function candidateSizes(
  data: ConfiguratorProductData,
): ReadonlyArray<{ readonly widthMm: number; readonly heightMm: number }> {
  const presets = [...data.options.presetSizes]
    .sort((a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm)
    .map((preset) => ({ widthMm: preset.widthMm, heightMm: preset.heightMm }));
  // A product with no presets (a `requiresExactSize` floor panel, say) is
  // still quoted from its own smallest permitted dimensions.
  return presets.length > 0
    ? presets
    : [{ widthMm: data.product.minWidthMm, heightMm: data.product.minHeightMm }];
}

/** `[null]` when the step does not apply, so the loops below stay one shape. */
function orNone<T>(applies: boolean, values: readonly T[]): ReadonlyArray<T | null> {
  return applies ? values : [null];
}

export async function computeStartingPriceGrossGrosze(productSlug: string): Promise<number | null> {
  const data = await getConfiguratorProductData(productSlug);
  if (data === null) {
    return null;
  }

  const steps: readonly StepCode[] = stepsForProductType(data.typeCode);
  // Needs the customer's own file before anything is knowable. Inventing a
  // number here is exactly what §14's "no fake pricing" rule forbids.
  if (steps.includes('CUSTOM_UPLOAD')) {
    return null;
  }

  const sizes = candidateSizes(data);
  const base = resolveOptions(data.options, EMPTY_SELECTIONS);

  let cheapest: number | null = null;

  for (const materialId of base.materialIds) {
    // Finishes, designs and thicknesses all narrow against the chosen
    // material, so they are re-resolved per material rather than once -
    // `domain/compatibility` is the authority on that and this must not
    // second-guess it.
    const withMaterial = resolveOptions(data.options, { ...EMPTY_SELECTIONS, materialId });

    for (const designId of orNone(steps.includes('DESIGN'), withMaterial.designIds)) {
      for (const finishId of orNone(steps.includes('FINISH'), withMaterial.finishIds)) {
        for (const thicknessMm of orNone(steps.includes('THICKNESS'), withMaterial.thicknessesMm)) {
          for (const installationVariant of orNone(
            steps.includes('INSTALLATION_VARIANT'),
            withMaterial.installVariantCodes,
          )) {
            for (const size of sizes) {
              const selections: Selections = {
                ...EMPTY_SELECTIONS,
                designId,
                materialId,
                finishId,
                thicknessMm,
                installationVariant,
                widthMm: size.widthMm,
                heightMm: size.heightMm,
              };
              const gross = priceOf(data, selections);
              if (gross !== null && (cheapest === null || gross < cheapest)) {
                cheapest = gross;
              }
            }
          }
        }
      }
    }
  }

  return cheapest;
}

/**
 * One combination's gross unit price, or `null` if it is not actually
 * buildable (infeasible dimensions, a blocking feasibility error, a
 * material the resolver offered but that this product type still cannot
 * complete). Pure - every row is already in `data`, so this loop does no
 * further database work however many combinations it walks.
 */
function priceOf(data: ConfiguratorProductData, selections: Selections): number | null {
  const material = selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
  if (material === null) {
    return null;
  }
  const design = selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
  if (stepsForProductType(data.typeCode).includes('DESIGN') && design === null) {
    return null;
  }

  const result = priceConfiguration(
    {
      product: data.product,
      material,
      design,
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

  if (result.status !== 'priced' || result.blockingError) {
    return null;
  }
  return result.priceBreakdown.unitGrossGrosze;
}

/**
 * Recomputes every active product's advertised price.
 *
 * Deliberately all-products rather than surgical per-entity invalidation: a
 * material's price, a finish's price, a compatibility row, a design's
 * machining time and a whole pricing version can each move many products at
 * once, and working out exactly which ones is both fiddly and the sort of
 * thing that goes subtly wrong. The whole catalogue is a handful of
 * products, each costing one query and some pure arithmetic, so the simple
 * version is also the correct one.
 */
/**
 * Call this from any admin operation that can move a price.
 *
 * A separate, obviously-named export rather than calling
 * `refreshAllStartingPrices()` directly at each site, so the reason is
 * visible at the call site and a future contributor can grep for every
 * place that participates.
 *
 * **Currently hooked:** publishing a pricing version, and creating,
 * editing or changing the availability of a product, material or finish.
 * **Not yet hooked:** design edits (machining time is a pricing input) and
 * the compatibility editors (product↔material, product↔design,
 * material↔finish, finish exclusions). Those change the option set a
 * starting price is derived from, so a stale "od X zł" can survive one
 * until the next hooked write. Tracked rather than silently accepted -
 * `docs/AI-CHECKLIST.md` BUG-02's follow-up. The consequence is bounded:
 * this is only the *advertised* figure, and the configurator, cart and
 * checkout all re-price live and remain authoritative.
 *
 * Never throws into the caller's path: an advertised price that failed to
 * refresh must not roll back the catalogue edit that succeeded.
 */
export async function refreshStartingPricesAfterCatalogueChange(): Promise<void> {
  try {
    await refreshAllStartingPrices();
  } catch (error) {
    logger.error('starting_price.refresh_failed', { error });
  }
}

export async function refreshAllStartingPrices(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: { isActive: true } },
    select: { id: true, slug: true, startingPriceGrossGrosze: true },
  });

  await Promise.all(
    products.map(async (product) => {
      const startingPriceGrossGrosze = await computeStartingPriceGrossGrosze(product.slug);
      if (startingPriceGrossGrosze === product.startingPriceGrossGrosze) {
        return;
      }
      // `updateMany`, not `update`: this is a read-then-write over a list
      // that another request may have changed in between, and `update`
      // throws P2025 if the row has since gone - which would reject the
      // whole `Promise.all` and abandon every other product's refresh over
      // one deleted row. "Affected 0 rows" is the correct, uneventful answer
      // when someone else got there first (ARCHITECTURE.md's own rule for
      // this shape).
      await prisma.product.updateMany({
        where: { id: product.id },
        data: { startingPriceGrossGrosze },
      });
    }),
  );
}

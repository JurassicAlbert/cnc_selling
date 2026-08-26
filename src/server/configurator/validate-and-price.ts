/**
 * Re-fetches a product's real catalogue data and re-prices a set of
 * selections server-side — the one thing both `addToCart`/
 * `updateCartItemConfiguration` (`src/server/actions/cart.ts`) and checkout
 * (`src/server/orders/create-order.ts`) need identically: never trust a
 * price, or even that a configuration is still valid, from anything other
 * than a fresh server-side recomputation (§10.2). Extracted to its own
 * plain module — not a `'use server'` file — so both can import it as an
 * ordinary function without crossing any server-action boundary.
 */

import { checkConfigurationComplete, stepsForProductType } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { priceConfiguration } from './price-configuration';
import type { ConfiguratorPricingResult } from './price-configuration';

export type ValidatedPricing = {
  readonly data: NonNullable<Awaited<ReturnType<typeof getConfiguratorProductData>>>;
  readonly pricing: Extract<ConfiguratorPricingResult, { status: 'priced' }>;
};

/** `null` whenever the configuration is incomplete, unpriceable, or blocked — the caller decides what that means for it. */
export async function priceAndValidateSelections(
  productSlug: string,
  selections: Selections,
): Promise<ValidatedPricing | null> {
  const data = await getConfiguratorProductData(productSlug);
  if (data === null) {
    return null;
  }
  const steps = stepsForProductType(data.typeCode);
  if (!checkConfigurationComplete(steps, selections).ok) {
    return null;
  }

  const material =
    selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
  const design = selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
  const finish = selections.finishId === null ? null : (data.finishesById.get(selections.finishId) ?? null);
  const thickness =
    selections.thicknessMm === null ? null : (data.thicknessesByMm.get(selections.thicknessMm) ?? null);
  const installationVariant =
    selections.installationVariant === null
      ? null
      : (data.installVariantsByCode.get(selections.installationVariant) ?? null);
  const font = selections.fontId === null ? null : (data.fontsById.get(selections.fontId) ?? null);

  // See `server/actions/configurator.ts`'s identical check: `design ===
  // null` only means "incomplete" for a product type that actually has
  // a DESIGN step. CUSTOM has none (CUSTOM_UPLOAD replaces it) — for it,
  // a null design is the correct, permanent state, not a missing one.
  const designIncomplete = steps.includes('DESIGN') && design === null;
  if (material === null || designIncomplete) {
    return null;
  }

  const pricing = priceConfiguration(
    {
      product: data.product,
      material,
      design,
      finish,
      thickness,
      installationVariant,
      personalizationSpec: data.personalizationSpec,
      font,
      machine: data.machine,
      pricing: data.pricing,
    },
    selections,
    1,
  );

  if (pricing.status !== 'priced' || pricing.blockingError) {
    return null;
  }

  return { data, pricing };
}

'use server';

/**
 * The configurator's one Server Action — ARCHITECTURE.md §7.1: "Every
 * selection change dispatches a Server Action that returns { price,
 * breakdown, moduleLayout, warnings, ... }. The UI renders that response; it
 * never derives a price locally." This is that dispatch target: fetch the
 * product's real rows, resolve this step's options, and price the current
 * selection, all server-side.
 */

import { checkConfigurationComplete, stepsForProductType } from '@/domain/configuration/steps';
import type { Selections, StepCode } from '@/domain/configuration/steps';
import type { ConfiguratorPricingResult } from '@/server/configurator/price-configuration';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import type { ResolvedOptionAvailability, ResolvedOptions } from '@/server/configurator/resolve-options';
import { resolveOptionAvailability, resolveOptions } from '@/server/configurator/resolve-options';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { getSession } from '@/server/auth/session';

export type ConfiguratorSnapshot = {
  readonly steps: readonly StepCode[];
  readonly options: ResolvedOptions;
  /** Every option, annotated available/unavailable-with-reason — never hidden (§7.2). */
  readonly availability: ResolvedOptionAvailability;
  readonly pricing: ConfiguratorPricingResult;
  readonly isComplete: boolean;
  /**
   * Null when this product offers no real personalization yet — no
   * `PersonalizationSpec` row, disabled, or no fonts assigned to it
   * (`availability.fonts` would be empty too). The UI's own gate for
   * "render the real step vs. the honest 'not offered yet' notice."
   */
  readonly personalization: { readonly maxCharacters: number; readonly maxLines: number } | null;
};

export type ConfiguratorSnapshotResult =
  | { readonly ok: true; readonly snapshot: ConfiguratorSnapshot }
  | { readonly ok: false; readonly code: 'PRODUCT_NOT_FOUND' };

export async function getConfiguratorSnapshot(
  productSlug: string,
  selections: Selections,
  quantity: number,
  /**
   * The client only ever sets this from the "Preview as customer" page's
   * own `?podglad=1` flag — never trusted on its own. Re-verified against
   * a real server-side session here, the same way `ProductPage` itself
   * does, since a Server Action call carries no other proof of who's
   * asking; a customer setting this to `true` by hand gets silently
   * ignored, not an error, matching this repo's "404, not 403" discipline
   * for anything that must not reveal whether a bypass exists.
   */
  isPreview = false,
): Promise<ConfiguratorSnapshotResult> {
  const session = isPreview ? await getSession() : null;
  const activeOnly = !(isPreview && (session?.role === 'STAFF' || session?.role === 'ADMIN'));
  const data = await getConfiguratorProductData(productSlug, activeOnly);
  if (data === null) {
    return { ok: false, code: 'PRODUCT_NOT_FOUND' };
  }

  const steps = stepsForProductType(data.typeCode);
  const options = resolveOptions(data.options, selections);
  const availability = resolveOptionAvailability(data.options, selections);

  const material =
    selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
  const design =
    selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
  const finish =
    selections.finishId === null ? null : (data.finishesById.get(selections.finishId) ?? null);
  const thickness =
    selections.thicknessMm === null
      ? null
      : (data.thicknessesByMm.get(selections.thicknessMm) ?? null);
  const installationVariant =
    selections.installationVariant === null
      ? null
      : (data.installVariantsByCode.get(selections.installationVariant) ?? null);
  const font = selections.fontId === null ? null : (data.fontsById.get(selections.fontId) ?? null);

  // `design === null` only means "incomplete" for a product type that
  // actually HAS a DESIGN step and the customer hasn't picked one yet.
  // CUSTOM has no DESIGN step at all (its design is the customer's own
  // upload, via CUSTOM_UPLOAD) — for it, `design` stays null forever and
  // that's the correct, complete state; `priceConfiguration`/
  // `calculatePrice` handle a null design explicitly rather than
  // guessing (see price-configuration.ts's header).
  const designIncomplete = steps.includes('DESIGN') && design === null;
  const pricing: ConfiguratorPricingResult =
    material === null || designIncomplete
      ? { status: 'incomplete' }
      : priceConfiguration(
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
          quantity,
        );

  const personalization =
    data.personalizationSpec?.isEnabled === true && options.fontIds.length > 0
      ? {
          maxCharacters: data.personalizationSpec.maxCharacters,
          maxLines: data.personalizationSpec.maxLines,
        }
      : null;

  return {
    ok: true,
    snapshot: {
      steps,
      options,
      availability,
      pricing,
      isComplete: checkConfigurationComplete(steps, selections).ok,
      personalization,
    },
  };
}

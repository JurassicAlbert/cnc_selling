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
import type { ResolvedOptions } from '@/server/configurator/resolve-options';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { getConfiguratorProductData } from '@/server/repositories/configurator';

export type ConfiguratorSnapshot = {
  readonly steps: readonly StepCode[];
  readonly options: ResolvedOptions;
  readonly pricing: ConfiguratorPricingResult;
  readonly isComplete: boolean;
};

export type ConfiguratorSnapshotResult =
  | { readonly ok: true; readonly snapshot: ConfiguratorSnapshot }
  | { readonly ok: false; readonly code: 'PRODUCT_NOT_FOUND' };

export async function getConfiguratorSnapshot(
  productSlug: string,
  selections: Selections,
  quantity: number,
): Promise<ConfiguratorSnapshotResult> {
  const data = await getConfiguratorProductData(productSlug);
  if (data === null) {
    return { ok: false, code: 'PRODUCT_NOT_FOUND' };
  }

  const steps = stepsForProductType(data.typeCode);
  const options = resolveOptions(data.options, selections);

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

  // priceConfiguration requires a concrete material and design row — a
  // product type with no DESIGN step (CUSTOM) or a customer who has not
  // chosen one yet never reaches 'priced'. See price-configuration.ts's
  // header for why CUSTOM specifically stays 'incomplete' by design.
  const pricing: ConfiguratorPricingResult =
    material === null || design === null
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
            machine: data.machine,
            pricing: data.pricing,
          },
          selections,
          quantity,
        );

  return {
    ok: true,
    snapshot: {
      steps,
      options,
      pricing,
      isComplete: checkConfigurationComplete(steps, selections).ok,
    },
  };
}

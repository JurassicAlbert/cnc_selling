/**
 * The configurator's pure selection logic - no React, no `'use client'`.
 *
 * Extracted from `Configurator.tsx` on 2026-09-05 for `docs/AI-CHECKLIST.md`
 * ARCH-02, which is not only about the file's size. `computeDefaultSelections`
 * was exported from a `'use client'` module purely so a unit test could reach
 * it, and Next treats every export of such a file as a client reference - so
 * the test surface included a client component. Here these are plain
 * functions, tested as plain functions
 * (`tests/unit/configurator-selections.test.ts`,
 * `tests/unit/configurator-defaults.test.ts`).
 *
 * Nothing about the behaviour changed in the move; the state model stays
 * exactly where it was, in `Configurator.tsx`, as ARCH-02 asks.
 */

import { EMPTY_SELECTIONS, stepsForProductType } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import type { ProductTypeCode } from '@/generated/prisma/enums';
import { resolveOptions } from '@/server/configurator/resolve-options';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';

export function cmInputFor(mm: number | null): string {
  return mm === null ? '' : formatMmAsCentimetres(mm);
}

/**
 * A real, immediately-priceable starting configuration - the product's own
 * first catalogue design, first material, that material's first available
 * finish, and a preset size (empty when the product has none, e.g.
 * `requiresExactSize` floor elements, which genuinely need the customer's
 * own measurement). Every field it fills stays a real breadcrumb the
 * customer can still change; this only removes the "nothing chosen yet"
 * starting state, never removes the choice itself.
 *
 * The size default prefers the MIDDLE preset ("Średni"), not the smallest
 * - found live, not assumed: the smallest preset on a real product
 * (`obraz-drewniany-z-grawerem`, 20×20 cm) is genuinely too small for that
 * design's minimum line width, so defaulting to it landed a first-time
 * visitor on an immediate, correct-but-unwelcoming feasibility warning.
 * The middle preset is the far more likely to be feasible starting point
 * for a product's own real dimension envelope.
 */
export function computeDefaultSelections(
  options: ConfiguratorOptionData,
  productTypeCode: ProductTypeCode,
): Selections {
  // Never choose on the customer's behalf a field this product type has no
  // step for. Added 2026-08-31 with BUG-06, which made the write path
  // refuse exactly that: JEWELRY has no FINISH step (§5), the seeded
  // bracelet's oak offers oiling, and the default therefore carried a
  // finishId the product is not allowed to have - a page that priced fine
  // and then refused to add to the cart. Tested in
  // `tests/unit/configurator-defaults.test.ts`.
  const steps = stepsForProductType(productTypeCode);
  // Filtered through the same §7.2 rules the picker and the server-side
  // gate use (`docs/REVIEW-DETAILED.md` BUG-03). This used to take
  // `options.designs[0]` and `options.materials[0]` raw, so a deactivated
  // material - or a design that was catalogued but never cleared for sale -
  // could become the default nobody chose. With pattern selection currently
  // hidden, that default is also the design that ends up in the order
  // snapshot and on the production sheet, which makes it the one selection
  // least able to afford being wrong.
  const selectableOptions = resolveOptions(options, EMPTY_SELECTIONS);
  const selectableDesigns = new Set(selectableOptions.designIds);
  const selectableMaterials = new Set(selectableOptions.materialIds);

  const defaultMaterial = options.materials.find((material) => selectableMaterials.has(material.id)) ?? null;
  const defaultDesign = options.designs.find((design) => selectableDesigns.has(design.id)) ?? null;
  const defaultFinish = defaultMaterial?.finishes.find((finish) => finish.isAvailable) ?? null;
  const defaultPreset =
    options.presetSizes[Math.floor(options.presetSizes.length / 2)] ?? options.presetSizes[0] ?? null;
  return {
    ...EMPTY_SELECTIONS,
    designId: steps.includes('DESIGN') ? (defaultDesign?.id ?? null) : null,
    materialId: defaultMaterial?.id ?? null,
    finishId: steps.includes('FINISH') ? (defaultFinish?.id ?? null) : null,
    widthMm: defaultPreset?.widthMm ?? null,
    heightMm: defaultPreset?.heightMm ?? null,
  };
}

/**
 * The URL is still the source of truth wherever it says something (a
 * shared link, a cart "Edytuj" link, a `/wzory` deep link) - `defaults`
 * only fills in whatever the URL left unset, so an explicit link (which
 * always carries every field a saved `Configuration` needs) is a no-op
 * here, and a bare product-page landing gets a fully real starting price.
 */
export function mergeWithDefaults(fromUrl: Selections, defaults: Selections): Selections {
  return {
    designId: fromUrl.designId ?? defaults.designId,
    customUploadId: fromUrl.customUploadId,
    materialId: fromUrl.materialId ?? defaults.materialId,
    widthMm: fromUrl.widthMm ?? defaults.widthMm,
    heightMm: fromUrl.heightMm ?? defaults.heightMm,
    thicknessMm: fromUrl.thicknessMm,
    finishId: fromUrl.finishId ?? defaults.finishId,
    installationVariant: fromUrl.installationVariant,
    personalizationText: fromUrl.personalizationText,
    fontId: fromUrl.fontId,
  };
}

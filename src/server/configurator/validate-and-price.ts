/**
 * Re-fetches a product's real catalogue data and re-prices a set of
 * selections server-side — the one thing both `addToCart`/
 * `updateCartItemConfiguration` (`src/server/operations/cart.ts`) and
 * checkout (`src/server/orders/create-order.ts`) need identically: never
 * trust a price, or even that a configuration is still valid, from
 * anything other than a fresh server-side recomputation (§10.2). Extracted
 * to its own plain module — not a `'use server'` file — so both can import
 * it as an ordinary function without crossing any server-action boundary.
 *
 * **This is also where §7.2's option rules are enforced**, added
 * 2026-08-31 for `docs/REVIEW-DETAILED.md` SEC-03.
 *
 * They were not enforced anywhere before. `domain/compatibility` was
 * correct and unit-tested, and was called only from `resolve-options.ts`,
 * whose output decides what the UI *renders*; this function resolved
 * material/design/finish by plain map lookup against maps that
 * `getConfiguratorProductData` builds with no `where` clause. So
 * `Material.isAvailable`, `Design.isActive`, `Design.rightsStatus`,
 * `DesignMaterial` narrowing and the offered-thickness list were all
 * display-only. A crafted request — or an ordinary customer holding a
 * saved project after staff retired a pattern — could price and order a
 * design the shop has no right to sell, which brief §12 and the
 * `rightsStatus` schema comment ("enforced by a query filter, not by
 * discipline") exist to prevent.
 *
 * The fix deliberately **reuses `resolveOptions`** rather than
 * re-implementing the rules here. One definition of "selectable", used by
 * both the picker and the gate, is the only version of this that cannot
 * drift — and §7.2 describes exactly one such set.
 */

import {
  checkConfigurationComplete,
  findSelectionOutsideProductType,
  stepsForProductType,
} from '@/domain/configuration/steps';
import { parseSelections } from '@/domain/configuration/input-schema';
import type { Selections, StepCode } from '@/domain/configuration/steps';
import type { ConfiguratorProductData } from '@/server/repositories/configurator';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { priceConfiguration } from './price-configuration';
import type { ConfiguratorPricingResult } from './price-configuration';

export type ValidatedPricing = {
  readonly data: NonNullable<Awaited<ReturnType<typeof getConfiguratorProductData>>>;
  readonly pricing: Extract<ConfiguratorPricingResult, { status: 'priced' }>;
  /**
   * The caller's selections **after** `parseSelections` — the value every
   * caller should use from here on, not the one it passed in.
   *
   * Added 2026-08-31 with BUG-07. A Server Action's arguments arrive as
   * whatever the caller sent, TypeScript notwithstanding, and
   * `applyAddToCart` fed them straight into `cartItemSignature` and a Prisma
   * `create`. A `personalizationText` that was an object crashed with
   * "selections.personalizationText.trim is not a function" — a 500 where a
   * clean rejection belonged. Returning the parsed object means there is one
   * canonical, checked value and no way to keep using the raw one by
   * accident.
   */
  readonly selections: Selections;
};

/**
 * `CONFIGURATION_INVALID` — incomplete, unpriceable, or blocked by a real
 * feasibility error. `OPTION_UNAVAILABLE` — every field is present, but one
 * of them names something this product does not (or no longer) offers.
 *
 * They are separate because they deserve separate copy: the second is
 * overwhelmingly a customer holding a link to something that has since been
 * retired, and "nieprawidłowa konfiguracja" tells that person nothing they
 * can act on.
 */
export type PricingRejectionCode = 'CONFIGURATION_INVALID' | 'OPTION_UNAVAILABLE';

/**
 * The product type's steps, minus any the product genuinely cannot offer a
 * single option for.
 *
 * Owner, 2026-08-31: "there shouldn't be cases where we allow something but
 * its blocked by system - this is logical issue." A step with nothing to
 * choose is the mirror image of that: the configuration is **required** to
 * carry a value the shop never offers, so it can never be completed at all.
 *
 * That was not hypothetical. The kitchen-tile product (`fartuch-kuchenny-z-
 * grawerem`) has `FINISH` in §5's step list, and its only material is gres —
 * porcelain stoneware, which has no `MaterialFinish` rows because it is not
 * a thing you oil or varnish. The product was therefore impossible to
 * configure, and had been since it was seeded. Found by
 * `tests/integration/offered-is-buildable.test.ts`.
 *
 * Narrowing here rather than editing §5's table or inventing a "no finish"
 * catalogue row: the step list is right for the product *type*, and what
 * varies is which options a particular product's materials actually
 * support. `calculatePrice` and `priceConfiguration` already accept `finish:
 * null` / `design: null` / `thickness: null`, so a genuinely absent option
 * costs nothing and adds nothing — which is the correct answer for
 * unfinished gres.
 *
 * MATERIAL and SIZE are never narrowed away: a product with no material
 * cannot be priced at all, and that should stay a hard failure rather than
 * quietly becoming a valid empty configuration.
 */
export function applicableSteps(data: ConfiguratorProductData, selections: Selections): readonly StepCode[] {
  const options = resolveOptions(data.options, selections);
  return stepsForProductType(data.typeCode).filter((step) => {
    switch (step) {
      case 'DESIGN':
        return options.designIds.length > 0;
      case 'FINISH':
        return options.finishIds.length > 0;
      case 'THICKNESS':
        return options.thicknessesMm.length > 0;
      case 'INSTALLATION_VARIANT':
        return options.installVariantCodes.length > 0;
      default:
        return true;
    }
  });
}

export type PriceAndValidateOutcome =
  | ({ readonly ok: true } & ValidatedPricing)
  | { readonly ok: false; readonly code: PricingRejectionCode };

const CONFIGURATION_INVALID = { ok: false, code: 'CONFIGURATION_INVALID' } as const;
const OPTION_UNAVAILABLE = { ok: false, code: 'OPTION_UNAVAILABLE' } as const;

/**
 * Every selected id must appear in the resolved option set for the
 * selection as a whole — not merely exist in the database.
 *
 * Order matters in one direction only: `resolveOptions` narrows designs by
 * the chosen material and materials by the chosen design simultaneously, so
 * an incompatible pair fails whichever way round it is checked. A `null`
 * selection is always fine here; whether it is *required* is
 * `checkConfigurationComplete`'s job, not this one's.
 */
function everySelectedOptionIsOffered(
  data: NonNullable<Awaited<ReturnType<typeof getConfiguratorProductData>>>,
  selections: Selections,
): boolean {
  const options = resolveOptions(data.options, selections);

  const offered = <T>(selected: T | null, available: readonly T[]): boolean =>
    selected === null || available.includes(selected);

  return (
    offered(selections.materialId, options.materialIds) &&
    offered(selections.designId, options.designIds) &&
    offered(selections.finishId, options.finishIds) &&
    offered(selections.thicknessMm, options.thicknessesMm) &&
    offered(selections.installationVariant, options.installVariantCodes) &&
    offered(selections.fontId, options.fontIds)
  );
}

export async function priceAndValidateSelections(
  productSlug: string,
  rawSelections: Selections,
): Promise<PriceAndValidateOutcome> {
  // Shape first, before anything reads a field or builds a query — BUG-07.
  // Nothing downstream can act on *why* the shape was wrong (the UI cannot
  // produce a malformed payload, so a caller that sends one is either a bug
  // or a crafted request), so both cases get the same generic rejection
  // rather than a new error code and new Polish copy for a state no
  // customer can reach.
  const selections = parseSelections(rawSelections);
  if (selections === null) {
    return CONFIGURATION_INVALID;
  }

  const data = await getConfiguratorProductData(productSlug);
  if (data === null) {
    return CONFIGURATION_INVALID;
  }

  // BUG-06: a selection belonging to a step this product *type* does not
  // have. Checked against `stepsForProductType`, not the narrowed
  // `applicableSteps` — see `findSelectionOutsideProductType`'s own comment
  // on why those are different questions with different answers.
  if (findSelectionOutsideProductType(stepsForProductType(data.typeCode), selections) !== null) {
    return CONFIGURATION_INVALID;
  }

  const steps = applicableSteps(data, selections);
  if (!checkConfigurationComplete(steps, selections).ok) {
    return CONFIGURATION_INVALID;
  }

  // Before anything is resolved or priced: an option that is not offered
  // must never reach the price calculation, because a price for it is a
  // price the shop would then be asked to honour.
  if (!everySelectedOptionIsOffered(data, selections)) {
    return OPTION_UNAVAILABLE;
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
    return CONFIGURATION_INVALID;
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
    return CONFIGURATION_INVALID;
  }

  return { ok: true, data, pricing, selections };
}

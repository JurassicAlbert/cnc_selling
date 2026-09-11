/**
 * "Is every chosen option still on offer?" - the one answer the picker and the
 * write path must never give differently.
 *
 * **Moved here on 2026-09-11 (P2-11).** It lived in
 * `src/server/configurator/resolve-options.ts`, and `Configurator.tsx` - a
 * Client Component - imported it from there as a runtime value. The logic was
 * always pure and always meant to be shared; only its address was wrong, and
 * an address under `src/server/` is a promise about what can safely be added
 * to the file later. `src/domain` is the layer that exists for exactly this:
 * framework-free, database-free, and legitimately reachable from both sides.
 *
 * `resolve-options.ts` re-exports both of these, so nothing that already
 * imported them from there had to change.
 */

import type { Selections } from '@/domain/configuration/steps';

export type ResolvedOptions = {
  readonly materialIds: readonly string[];
  readonly designIds: readonly string[];
  /** Empty before a material is chosen - there is nothing to resolve finishes against yet. */
  readonly finishIds: readonly string[];
  readonly thicknessesMm: readonly number[];
  /** Unfiltered - nothing narrows which installation variants exist. */
  readonly installVariantCodes: readonly string[];
  /** Unfiltered - no compatibility rule narrows which font applies, unlike material/design. */
  readonly fontIds: readonly string[];
};

/**
 * The first selection naming something the shop does not currently offer, or
 * `null` when every set field is selectable.
 *
 * Added 2026-09-04 for `docs/REVIEW-DETAILED.md` UX-21, and shared on purpose.
 * The server calls it from `priceAndValidateSelections` after `resolveOptions`;
 * the configurator calls it against the `ResolvedOptions` already in its
 * snapshot. SEC-03 happened because the picker's rules and the write path's
 * rules were two separate pieces of code that disagreed, and answering the
 * same question twice in two places is how that recurs.
 *
 * Order is not arbitrary. A retired pattern is overwhelmingly why a saved
 * project or a shared link stops being orderable, so the design is checked
 * first and the customer gets the sentence they can act on rather than a
 * technically-true one about a material they never touched.
 *
 * `widthMm`/`heightMm` and `customUploadId` are absent deliberately: the
 * first two are bounded by the product's dimension envelope and the third by
 * ownership, and neither is a question a `ResolvedOptions` can answer.
 * Reporting them here would name the wrong thing.
 */
export function findUnavailableSelection(
  options: ResolvedOptions,
  selections: Selections,
): keyof Selections | null {
  const offered = <T>(selected: T | null, available: readonly T[]): boolean =>
    selected === null || available.includes(selected);

  if (!offered(selections.designId, options.designIds)) {
    return 'designId';
  }
  if (!offered(selections.materialId, options.materialIds)) {
    return 'materialId';
  }
  if (!offered(selections.finishId, options.finishIds)) {
    return 'finishId';
  }
  if (!offered(selections.thicknessMm, options.thicknessesMm)) {
    return 'thicknessMm';
  }
  if (!offered(selections.installationVariant, options.installVariantCodes)) {
    return 'installationVariant';
  }
  if (!offered(selections.fontId, options.fontIds)) {
    return 'fontId';
  }
  return null;
}

/**
 * The configurator step machine — ARCHITECTURE.md §7.1.
 *
 * "The configurator is a finite state machine driven by the product type's
 * step list (§5), not a form." This module owns exactly that machine: which
 * steps exist for a product type, whether a given step can be entered yet,
 * and whether the whole configuration is complete. It does NOT resolve
 * *which options* are valid for a step (which material, which finish) — that
 * is `domain/compatibility`, already built, and combining the two is a
 * server-layer concern once real product/compatibility rows exist.
 *
 * "A step is enterable only if all prior required selections are valid" is
 * read literally: step N is enterable iff every step before it in the list
 * is satisfied, not just the immediately preceding one — skipping around is
 * not possible even if a middle step happens to already hold a value.
 */

export type ProductTypeCode =
  | 'WALL_ART'
  | 'TABLE_TOP'
  | 'KITCHEN_TILE'
  | 'FLOOR_ELEMENT'
  | 'CUSTOM'
  | 'LOFT_FURNITURE'
  | 'JEWELRY';

export type StepCode =
  | 'DESIGN'
  | 'MATERIAL'
  | 'SIZE'
  | 'THICKNESS'
  | 'FINISH'
  | 'INSTALLATION_VARIANT'
  | 'PERSONALIZATION'
  | 'CUSTOM_UPLOAD'
  | 'SUMMARY';

/** ARCHITECTURE.md §5's table, verbatim. */
const STEPS_BY_PRODUCT_TYPE: Readonly<Record<ProductTypeCode, readonly StepCode[]>> = {
  WALL_ART: ['DESIGN', 'MATERIAL', 'SIZE', 'FINISH', 'PERSONALIZATION', 'SUMMARY'],
  TABLE_TOP: ['DESIGN', 'MATERIAL', 'SIZE', 'THICKNESS', 'FINISH', 'PERSONALIZATION', 'SUMMARY'],
  KITCHEN_TILE: ['INSTALLATION_VARIANT', 'DESIGN', 'MATERIAL', 'SIZE', 'FINISH', 'SUMMARY'],
  FLOOR_ELEMENT: ['MATERIAL', 'SIZE', 'THICKNESS', 'DESIGN', 'FINISH', 'SUMMARY'],
  CUSTOM: ['CUSTOM_UPLOAD', 'MATERIAL', 'SIZE', 'FINISH', 'PERSONALIZATION', 'SUMMARY'],
  // Identical to TABLE_TOP — the frame/base is product copy, not a step. See
  // docs/HANDOVER.md §9d.
  LOFT_FURNITURE: ['DESIGN', 'MATERIAL', 'SIZE', 'THICKNESS', 'FINISH', 'PERSONALIZATION', 'SUMMARY'],
  // No THICKNESS (a small blank has one fixed thickness) and no FINISH
  // (nothing seeded for it yet).
  JEWELRY: ['DESIGN', 'MATERIAL', 'SIZE', 'PERSONALIZATION', 'SUMMARY'],
};

export function stepsForProductType(productType: ProductTypeCode): readonly StepCode[] {
  return STEPS_BY_PRODUCT_TYPE[productType];
}

export type Selections = {
  readonly designId: string | null;
  readonly customUploadId: string | null;
  readonly materialId: string | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly thicknessMm: number | null;
  readonly finishId: string | null;
  readonly installationVariant: string | null;
  /** Optional — a customer may buy a piece with no engraved text at all. */
  readonly personalizationText: string | null;
  readonly fontId: string | null;
};

export const EMPTY_SELECTIONS: Selections = {
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
};

/**
 * PERSONALIZATION and SUMMARY are always satisfied by construction —
 * personalization is optional (brief never requires engraved text), and
 * SUMMARY has no selection of its own, it only requires everything before it.
 */
export function isStepSatisfied(step: StepCode, selections: Selections): boolean {
  switch (step) {
    case 'DESIGN':
      return selections.designId !== null;
    case 'CUSTOM_UPLOAD':
      return selections.customUploadId !== null;
    case 'MATERIAL':
      return selections.materialId !== null;
    case 'SIZE':
      return selections.widthMm !== null && selections.heightMm !== null;
    case 'THICKNESS':
      return selections.thicknessMm !== null;
    case 'FINISH':
      return selections.finishId !== null;
    case 'INSTALLATION_VARIANT':
      return selections.installationVariant !== null;
    case 'PERSONALIZATION':
    case 'SUMMARY':
      return true;
  }
}

export function isStepEnterable(
  steps: readonly StepCode[],
  index: number,
  selections: Selections,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) {
    return false;
  }
  for (let i = 0; i < index; i++) {
    if (!isStepSatisfied(steps[i] as StepCode, selections)) {
      return false;
    }
  }
  return true;
}

/** The furthest step a returning customer can resume at, given what they've already chosen. */
export function furthestEnterableStepIndex(
  steps: readonly StepCode[],
  selections: Selections,
): number {
  let furthest = 0;
  for (let index = 1; index < steps.length; index++) {
    if (!isStepEnterable(steps, index, selections)) {
      break;
    }
    furthest = index;
  }
  return furthest;
}

export function isConfigurationComplete(
  steps: readonly StepCode[],
  selections: Selections,
): boolean {
  return steps.every((step) => isStepSatisfied(step, selections));
}

export type ConfigurationErrorCode =
  | 'STEP_INDEX_OUT_OF_RANGE'
  | 'STEP_NOT_YET_ENTERABLE'
  | 'STEP_NOT_IN_PRODUCT_TYPE'
  | 'CONFIGURATION_INCOMPLETE';

export type StepResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ConfigurationErrorCode };

/** The entry guard behind "browser back/forward" and "refresh mid-configuration" (brief §36). */
export function checkStepEntry(
  steps: readonly StepCode[],
  index: number,
  selections: Selections,
): StepResult {
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) {
    return { ok: false, code: 'STEP_INDEX_OUT_OF_RANGE' };
  }
  if (!isStepEnterable(steps, index, selections)) {
    return { ok: false, code: 'STEP_NOT_YET_ENTERABLE' };
  }
  return { ok: true };
}

/** Rejects e.g. setting a THICKNESS selection on a product type with no THICKNESS step. */
export function checkStepAppliesToProductType(
  steps: readonly StepCode[],
  step: StepCode,
): StepResult {
  return steps.includes(step) ? { ok: true } : { ok: false, code: 'STEP_NOT_IN_PRODUCT_TYPE' };
}

/**
 * Which step owns each selection field. `materialId`, `widthMm` and
 * `heightMm` are absent on purpose: MATERIAL and SIZE appear in every
 * product type's list (§5), so a check for them could never fire, and
 * writing one would imply the opposite.
 */
const STEP_OWNING_SELECTION: Readonly<Partial<Record<keyof Selections, StepCode>>> = {
  designId: 'DESIGN',
  customUploadId: 'CUSTOM_UPLOAD',
  thicknessMm: 'THICKNESS',
  finishId: 'FINISH',
  installationVariant: 'INSTALLATION_VARIANT',
  personalizationText: 'PERSONALIZATION',
  fontId: 'PERSONALIZATION',
};

export type SelectionOutsideProductType = {
  readonly selection: keyof Selections;
  readonly step: StepCode;
};

/**
 * The first selection that is set but belongs to a step this product type
 * does not have — `null` when every set field is in scope.
 *
 * Written 2026-08-31 for `docs/REVIEW-DETAILED.md` BUG-06.
 * `checkStepAppliesToProductType` above had existed, with tests, since P3,
 * and **nothing had ever called it**: `docs/CHECKLIST.md` claimed it
 * "rejects e.g. a THICKNESS selection on WALL_ART" while the running
 * application accepted exactly that. The consequences were real, not
 * theoretical — `personalizationText` was stored and shown for products
 * with no `PersonalizationSpec` (so `evaluatePersonalization` returned no
 * issues and **no length limit of any kind applied**), and a `thicknessMm`
 * reached the immutable order snapshot for a wall panel, where an order
 * could read "Grubość: 999 mm".
 *
 * Deliberately takes the **product type's** steps, not the narrowed list
 * `applicableSteps` produces. They answer different questions: this one is
 * "no such step exists for this kind of product", which is a malformed
 * request; the narrowed list drives "this product offers nothing to choose
 * here", which is a real, orderable configuration. Conflating them would
 * turn `OPTION_UNAVAILABLE` — a message a customer on a stale link can act
 * on — into a generic invalid-configuration error.
 */
export function findSelectionOutsideProductType(
  steps: readonly StepCode[],
  selections: Selections,
): SelectionOutsideProductType | null {
  for (const [selection, step] of Object.entries(STEP_OWNING_SELECTION)) {
    const value = selections[selection as keyof Selections];
    if (value === null || value === undefined) {
      continue;
    }
    if (!checkStepAppliesToProductType(steps, step).ok) {
      return { selection: selection as keyof Selections, step };
    }
  }
  return null;
}

/** The gate on reaching SUMMARY / add-to-cart. */
export function checkConfigurationComplete(
  steps: readonly StepCode[],
  selections: Selections,
): StepResult {
  return isConfigurationComplete(steps, selections)
    ? { ok: true }
    : { ok: false, code: 'CONFIGURATION_INCOMPLETE' };
}

import { describe, expect, it } from 'vitest';

import {
  checkConfigurationComplete,
  checkStepAppliesToProductType,
  checkStepEntry,
  EMPTY_SELECTIONS,
  furthestEnterableStepIndex,
  isConfigurationComplete,
  isStepEnterable,
  stepsForProductType,
  type Selections,
} from '@/domain/configuration/steps';

/**
 * The configurator step machine - ARCHITECTURE.md §5 (per-product-type step
 * lists) and §7.1 (a step is enterable only if every prior required
 * selection is valid). Pure: no product ids, no compatibility resolution -
 * that lives in `domain/compatibility` and is combined with this module by
 * the server layer, not duplicated here.
 */

function selections(overrides: Partial<Selections>): Selections {
  return { ...EMPTY_SELECTIONS, ...overrides };
}

describe('stepsForProductType', () => {
  it('WALL_ART - no THICKNESS, no INSTALLATION_VARIANT', () => {
    expect(stepsForProductType('WALL_ART')).toEqual([
      'DESIGN',
      'MATERIAL',
      'SIZE',
      'FINISH',
      'PERSONALIZATION',
      'SUMMARY',
    ]);
  });

  it('TABLE_TOP and LOFT_FURNITURE share the identical step list', () => {
    expect(stepsForProductType('TABLE_TOP')).toEqual(stepsForProductType('LOFT_FURNITURE'));
    expect(stepsForProductType('TABLE_TOP')).toEqual([
      'DESIGN',
      'MATERIAL',
      'SIZE',
      'THICKNESS',
      'FINISH',
      'PERSONALIZATION',
      'SUMMARY',
    ]);
  });

  it('KITCHEN_TILE opens with INSTALLATION_VARIANT, before DESIGN', () => {
    const steps = stepsForProductType('KITCHEN_TILE');
    expect(steps[0]).toBe('INSTALLATION_VARIANT');
    expect(steps.indexOf('INSTALLATION_VARIANT')).toBeLessThan(steps.indexOf('DESIGN'));
    expect(steps).not.toContain('THICKNESS');
    expect(steps).not.toContain('PERSONALIZATION');
  });

  it('FLOOR_ELEMENT has THICKNESS and no INSTALLATION_VARIANT', () => {
    expect(stepsForProductType('FLOOR_ELEMENT')).toEqual([
      'MATERIAL',
      'SIZE',
      'THICKNESS',
      'DESIGN',
      'FINISH',
      'SUMMARY',
    ]);
  });

  it('CUSTOM opens with CUSTOM_UPLOAD instead of DESIGN', () => {
    const steps = stepsForProductType('CUSTOM');
    expect(steps[0]).toBe('CUSTOM_UPLOAD');
    expect(steps).not.toContain('DESIGN');
  });

  it('JEWELRY has no THICKNESS and no FINISH', () => {
    expect(stepsForProductType('JEWELRY')).toEqual([
      'DESIGN',
      'MATERIAL',
      'SIZE',
      'PERSONALIZATION',
      'SUMMARY',
    ]);
  });

  it('every product type ends with SUMMARY', () => {
    const types = [
      'WALL_ART',
      'TABLE_TOP',
      'KITCHEN_TILE',
      'FLOOR_ELEMENT',
      'CUSTOM',
      'LOFT_FURNITURE',
      'JEWELRY',
    ] as const;
    for (const type of types) {
      const steps = stepsForProductType(type);
      expect(steps.at(-1)).toBe('SUMMARY');
    }
  });
});

describe('isStepEnterable - a step opens only once every prior step is satisfied', () => {
  const steps = stepsForProductType('WALL_ART'); // DESIGN, MATERIAL, SIZE, FINISH, PERSONALIZATION, SUMMARY

  it('the first step is always enterable, regardless of selections', () => {
    expect(isStepEnterable(steps, 0, EMPTY_SELECTIONS)).toBe(true);
  });

  it('the second step is not enterable before the first is satisfied', () => {
    expect(isStepEnterable(steps, 1, EMPTY_SELECTIONS)).toBe(false);
  });

  it('the second step becomes enterable once the first is satisfied', () => {
    expect(isStepEnterable(steps, 1, selections({ designId: 'linoryt-01' }))).toBe(true);
  });

  it('a later step needs every prior step, not just the immediately preceding one', () => {
    const onlyDesign = selections({ designId: 'linoryt-01' });
    expect(isStepEnterable(steps, 2, onlyDesign)).toBe(false); // MATERIAL missing
    const designAndMaterial = selections({ designId: 'linoryt-01', materialId: 'dab' });
    expect(isStepEnterable(steps, 2, designAndMaterial)).toBe(true); // SIZE step itself has no prerequisite of its own value
  });

  it('SIZE requires BOTH width and height, not just one', () => {
    const withDesignMaterial = selections({ designId: 'linoryt-01', materialId: 'dab' });
    const widthOnly = selections({ ...withDesignMaterial, widthMm: 600 });
    expect(isStepEnterable(steps, 3, widthOnly)).toBe(false); // FINISH needs SIZE satisfied
    const both = selections({ ...withDesignMaterial, widthMm: 600, heightMm: 400 });
    expect(isStepEnterable(steps, 3, both)).toBe(true);
  });

  it('PERSONALIZATION is optional - its absence never blocks the step after it (SUMMARY)', () => {
    const everythingButPersonalization = selections({
      designId: 'linoryt-01',
      materialId: 'dab',
      widthMm: 600,
      heightMm: 400,
      finishId: 'olejowanie',
    });
    expect(isStepEnterable(steps, 5, everythingButPersonalization)).toBe(true); // SUMMARY
  });

  it('an out-of-range index is never enterable', () => {
    expect(isStepEnterable(steps, -1, EMPTY_SELECTIONS)).toBe(false);
    expect(isStepEnterable(steps, steps.length, EMPTY_SELECTIONS)).toBe(false);
  });
});

describe('furthestEnterableStepIndex - where a returning customer resumes', () => {
  const steps = stepsForProductType('WALL_ART');

  it('resumes at 0 with nothing selected', () => {
    expect(furthestEnterableStepIndex(steps, EMPTY_SELECTIONS)).toBe(0);
  });

  it('resumes exactly at the first unsatisfied step', () => {
    const partial = selections({ designId: 'linoryt-01', materialId: 'dab' });
    expect(furthestEnterableStepIndex(steps, partial)).toBe(2); // SIZE, index 2
  });

  it('resumes at the last step once everything is satisfied', () => {
    const complete = selections({
      designId: 'linoryt-01',
      materialId: 'dab',
      widthMm: 600,
      heightMm: 400,
      finishId: 'olejowanie',
    });
    expect(furthestEnterableStepIndex(steps, complete)).toBe(steps.length - 1);
  });
});

describe('checkStepEntry - the entry guard, with a reason code', () => {
  const steps = stepsForProductType('WALL_ART');

  it('ok for the first step', () => {
    expect(checkStepEntry(steps, 0, EMPTY_SELECTIONS)).toEqual({ ok: true });
  });

  it('rejects an index before entering prerequisites are met', () => {
    const result = checkStepEntry(steps, 2, EMPTY_SELECTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_NOT_YET_ENTERABLE');
  });

  it('rejects a negative index', () => {
    const result = checkStepEntry(steps, -1, EMPTY_SELECTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_INDEX_OUT_OF_RANGE');
  });

  it('rejects an index past the end of the step list', () => {
    const result = checkStepEntry(steps, 99, EMPTY_SELECTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_INDEX_OUT_OF_RANGE');
  });

  it('rejects a non-integer index', () => {
    const result = checkStepEntry(steps, 1.5, EMPTY_SELECTIONS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_INDEX_OUT_OF_RANGE');
  });
});

describe('checkStepAppliesToProductType - rejects a step foreign to this product type', () => {
  it('THICKNESS does not apply to WALL_ART', () => {
    const steps = stepsForProductType('WALL_ART');
    const result = checkStepAppliesToProductType(steps, 'THICKNESS');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_NOT_IN_PRODUCT_TYPE');
  });

  it('INSTALLATION_VARIANT does not apply to JEWELRY', () => {
    const steps = stepsForProductType('JEWELRY');
    const result = checkStepAppliesToProductType(steps, 'INSTALLATION_VARIANT');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('STEP_NOT_IN_PRODUCT_TYPE');
  });

  it('THICKNESS does apply to TABLE_TOP', () => {
    const steps = stepsForProductType('TABLE_TOP');
    expect(checkStepAppliesToProductType(steps, 'THICKNESS')).toEqual({ ok: true });
  });
});

describe('isConfigurationComplete / checkConfigurationComplete', () => {
  it('WALL_ART is complete without personalization (optional step)', () => {
    const steps = stepsForProductType('WALL_ART');
    const complete = selections({
      designId: 'linoryt-01',
      materialId: 'dab',
      widthMm: 600,
      heightMm: 400,
      finishId: 'olejowanie',
    });
    expect(isConfigurationComplete(steps, complete)).toBe(true);
    expect(checkConfigurationComplete(steps, complete)).toEqual({ ok: true });
  });

  it('WALL_ART is incomplete without a finish', () => {
    const steps = stepsForProductType('WALL_ART');
    const missingFinish = selections({
      designId: 'linoryt-01',
      materialId: 'dab',
      widthMm: 600,
      heightMm: 400,
    });
    expect(isConfigurationComplete(steps, missingFinish)).toBe(false);
    const result = checkConfigurationComplete(steps, missingFinish);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFIGURATION_INCOMPLETE');
  });

  it('KITCHEN_TILE is incomplete without an installation variant, even with everything else set', () => {
    const steps = stepsForProductType('KITCHEN_TILE');
    const missingVariant = selections({
      designId: 'wzor-01',
      materialId: 'gres-bialy',
      widthMm: 700,
      heightMm: 1200,
      finishId: 'brak',
    });
    expect(isConfigurationComplete(steps, missingVariant)).toBe(false);
  });

  it('FLOOR_ELEMENT requires THICKNESS to be complete', () => {
    const steps = stepsForProductType('FLOOR_ELEMENT');
    const missingThickness = selections({
      materialId: 'dab',
      widthMm: 1200,
      heightMm: 180,
      designId: 'wzor-01',
      finishId: 'olejowanie',
    });
    expect(isConfigurationComplete(steps, missingThickness)).toBe(false);
  });

  it('CUSTOM is complete via CUSTOM_UPLOAD, not DESIGN (which it does not have)', () => {
    const steps = stepsForProductType('CUSTOM');
    const complete = selections({
      customUploadId: 'upload-abc',
      materialId: 'dab',
      widthMm: 500,
      heightMm: 500,
      finishId: 'olejowanie',
    });
    expect(isConfigurationComplete(steps, complete)).toBe(true);
  });
});

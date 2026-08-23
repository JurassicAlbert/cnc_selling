import { describe, expect, it } from 'vitest';

import type {
  DesignConstraints,
  FeasibilityInput,
  MaterialConstraints,
} from '@/domain/feasibility/rules';
import {
  acknowledgementsRequired,
  canProceed,
  evaluateFeasibility,
  hasBlockingError,
} from '@/domain/feasibility/rules';

/** A linocut-style design drawn for a 600 mm wide panel. */
const DESIGN: DesignConstraints = {
  referenceWidthMm: 600,
  minLineWidthMm: 1.2,
  minDetailSpacingMm: 2,
  detailLevel: 3,
  minRecommendedWidthMm: 400,
};

/** Oak: holds a 1.2 mm line. */
const OAK: MaterialConstraints = {
  minLineWidthMm: 1.2,
  minDetailSpacingMm: 2,
  isNaturalVariable: true,
};

/** MDF: takes finer detail and has no grain to disclaim. */
const MDF: MaterialConstraints = {
  minLineWidthMm: 0.6,
  minDetailSpacingMm: 1,
  isNaturalVariable: false,
};

const BASE: FeasibilityInput = {
  widthMm: 600,
  design: DESIGN,
  material: OAK,
  moduleCount: 1,
  isFloorElement: false,
};

function codesOf(overrides: Partial<FeasibilityInput> = {}): string[] {
  return evaluateFeasibility({ ...BASE, ...overrides }).map((f) => f.code);
}

describe('evaluateFeasibility — line width scales with the product', () => {
  it('passes at the design reference width', () => {
    expect(codesOf()).not.toContain('LINE_TOO_THIN');
  });

  it('fails at half the reference width, where every line is half as wide', () => {
    // 1.2 mm x (300 / 600) = 0.6 mm, below oak's 1.2 mm minimum.
    expect(codesOf({ widthMm: 300 })).toContain('LINE_TOO_THIN');
  });

  it('passes at half the reference width on a material that holds finer lines', () => {
    expect(codesOf({ widthMm: 300, material: MDF })).not.toContain('LINE_TOO_THIN');
  });

  it('passes when scaled UP, because lines get wider', () => {
    expect(codesOf({ widthMm: 1200 })).not.toContain('LINE_TOO_THIN');
  });

  it('passes exactly at the boundary rather than failing on rounding', () => {
    // Reference 600 -> 600 gives exactly 1.2 mm, which oak allows.
    const findings = evaluateFeasibility({ ...BASE, widthMm: 600 });
    expect(findings.map((f) => f.code)).not.toContain('LINE_TOO_THIN');
  });

  it('reports the effective width and the requirement, for a specific message', () => {
    const finding = evaluateFeasibility({ ...BASE, widthMm: 300 }).find(
      (f) => f.code === 'LINE_TOO_THIN',
    );
    expect(finding?.params).toEqual({
      effectiveLineWidthMm: 0.6,
      requiredMm: 1.2,
    });
  });

  it('blocks rather than warns — a line too thin cannot be cut at all', () => {
    const finding = evaluateFeasibility({ ...BASE, widthMm: 300 }).find(
      (f) => f.code === 'LINE_TOO_THIN',
    );
    expect(finding?.severity).toBe('error');
  });
});

describe('evaluateFeasibility — detail spacing', () => {
  it('fails when scaled-down details would merge', () => {
    expect(codesOf({ widthMm: 200 })).toContain('DETAIL_SPACING_TOO_TIGHT');
  });

  it('passes on a material that takes tighter detail', () => {
    expect(codesOf({ widthMm: 400, material: MDF })).not.toContain(
      'DETAIL_SPACING_TOO_TIGHT',
    );
  });
});

describe('evaluateFeasibility — very detailed designs', () => {
  const detailed: DesignConstraints = {
    ...DESIGN,
    detailLevel: 5,
    minLineWidthMm: 2.4,
    minRecommendedWidthMm: 800,
  };

  it('warns when a detailed design is ordered below its recommended size', () => {
    const codes = codesOf({ design: detailed, widthMm: 700 });
    expect(codes).toContain('DESIGN_TOO_DETAILED');
  });

  it('does not warn at or above the recommended size', () => {
    expect(codesOf({ design: detailed, widthMm: 800 })).not.toContain(
      'DESIGN_TOO_DETAILED',
    );
  });

  it('does not warn for a design that is not detailed', () => {
    expect(codesOf({ widthMm: 100, material: MDF })).not.toContain(
      'DESIGN_TOO_DETAILED',
    );
  });

  it('warns rather than blocks, and requires acknowledgement', () => {
    const finding = evaluateFeasibility({
      ...BASE,
      design: detailed,
      widthMm: 700,
    }).find((f) => f.code === 'DESIGN_TOO_DETAILED');
    expect(finding?.severity).toBe('warning');
    expect(finding?.requiresAcknowledgement).toBe(true);
  });
});

describe('evaluateFeasibility — notices', () => {
  it('notes a modular build without treating it as a problem', () => {
    const finding = evaluateFeasibility({ ...BASE, moduleCount: 6 }).find(
      (f) => f.code === 'MODULAR_BUILD',
    );
    expect(finding?.severity).toBe('notice');
    expect(finding?.requiresAcknowledgement).toBe(false);
    expect(finding?.params).toEqual({ moduleCount: 6 });
  });

  it('says nothing about modules for a single-piece product', () => {
    expect(codesOf()).not.toContain('MODULAR_BUILD');
  });

  it('discloses natural variation for solid wood', () => {
    expect(codesOf()).toContain('NATURAL_VARIATION');
  });

  it('does not disclose natural variation for MDF', () => {
    expect(codesOf({ material: MDF })).not.toContain('NATURAL_VARIATION');
  });
});

describe('evaluateFeasibility — floor elements', () => {
  it('warns that an exact match to existing flooring is not guaranteed', () => {
    const finding = evaluateFeasibility({ ...BASE, isFloorElement: true }).find(
      (f) => f.code === 'FLOOR_MATCH_NOT_GUARANTEED',
    );
    expect(finding?.severity).toBe('warning');
    expect(finding?.requiresAcknowledgement).toBe(true);
  });

  it('says nothing about floor matching for wall art', () => {
    expect(codesOf()).not.toContain('FLOOR_MATCH_NOT_GUARANTEED');
  });
});

describe('the add-to-cart gate', () => {
  it('lets a clean configuration through', () => {
    const findings = evaluateFeasibility({ ...BASE, material: MDF });
    expect(hasBlockingError(findings)).toBe(false);
    expect(canProceed(findings, [])).toBe(true);
  });

  it('blocks on an error no matter what was acknowledged', () => {
    const findings = evaluateFeasibility({ ...BASE, widthMm: 300 });
    expect(hasBlockingError(findings)).toBe(true);
    expect(canProceed(findings, ['LINE_TOO_THIN', 'DESIGN_TOO_DETAILED'])).toBe(
      false,
    );
  });

  it('blocks until an outstanding warning is acknowledged', () => {
    const findings = evaluateFeasibility({
      ...BASE,
      material: MDF,
      isFloorElement: true,
    });
    expect(canProceed(findings, [])).toBe(false);
    expect(canProceed(findings, ['FLOOR_MATCH_NOT_GUARANTEED'])).toBe(true);
  });

  it('lists exactly which acknowledgements are outstanding', () => {
    const findings = evaluateFeasibility({
      ...BASE,
      material: MDF,
      design: { ...DESIGN, detailLevel: 5, minRecommendedWidthMm: 800 },
      widthMm: 700,
      isFloorElement: true,
    });
    expect(acknowledgementsRequired(findings).sort()).toEqual([
      'DESIGN_TOO_DETAILED',
      'FLOOR_MATCH_NOT_GUARANTEED',
    ]);
  });

  it('does not require acknowledging a notice', () => {
    const findings = evaluateFeasibility({ ...BASE, moduleCount: 4 });
    expect(acknowledgementsRequired(findings)).not.toContain('MODULAR_BUILD');
    expect(acknowledgementsRequired(findings)).not.toContain('NATURAL_VARIATION');
  });
});

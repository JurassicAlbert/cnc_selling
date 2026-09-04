/**
 * Production feasibility.
 *
 * Three severities with genuinely different consequences:
 *
 *   error   - cannot be manufactured. Blocks Next and add-to-cart.
 *   warning - manufacturable, but the result may disappoint. Requires an
 *             explicit acknowledgement before the customer can continue.
 *   notice  - informational. Displayed, no interaction.
 *
 * Nothing here ever silently alters the customer's choice. It reports; the
 * customer decides.
 */

export type Severity = 'error' | 'warning' | 'notice';

/**
 * The closed set, as a runtime value rather than only a type - 2026-08-31,
 * for `docs/REVIEW-DETAILED.md` BUG-07. `Configuration.acknowledgedWarnings`
 * is a `String[]` column that a Server Action wrote straight through with no
 * allow-list at all, so a crafted request could store arbitrary strings in
 * it. Validating against a union type is impossible; validating against this
 * array is trivial, and deriving `FeasibilityCode` from it keeps the two
 * from ever disagreeing.
 */
export const FEASIBILITY_CODES = [
  'LINE_TOO_THIN',
  'DESIGN_TOO_DETAILED',
  'DETAIL_SPACING_TOO_TIGHT',
  'MODULAR_BUILD',
  'NATURAL_VARIATION',
  'FLOOR_MATCH_NOT_GUARANTEED',
  'THICKNESS_EXCEEDS_MACHINE',
  /**
   * Constructed by `domain/joinery`'s `buildJoineryFinding`, not by
   * `evaluateFeasibility` below - that function never produces this code,
   * so it stays inert until something calls `buildJoineryFinding`
   * directly, which nothing does yet (prepared but disabled).
   */
  'JOINED_PANEL_YATO_YANE',
] as const;

export type FeasibilityCode = (typeof FEASIBILITY_CODES)[number];

export type FeasibilityFinding = {
  readonly code: FeasibilityCode;
  readonly severity: Severity;
  /** Warnings must be acknowledged; errors block; notices are informational. */
  readonly requiresAcknowledgement: boolean;
  readonly params: Readonly<Record<string, number | string>>;
};

export type DesignConstraints = {
  /** The width at which the minimums below are declared. */
  readonly referenceWidthMm: number;
  readonly minLineWidthMm: number;
  readonly minDetailSpacingMm: number;
  /** 1..5. 4 and above is "very detailed". */
  readonly detailLevel: number;
  /** Below this width the design loses its character. */
  readonly minRecommendedWidthMm: number;
};

export type MaterialConstraints = {
  readonly minLineWidthMm: number;
  readonly minDetailSpacingMm: number;
  /** Solid wood varies in grain, colour and knots. */
  readonly isNaturalVariable: boolean;
};

export type MachineConstraints = {
  /** The machine's real Z-axis clearance (D7). A workpiece thicker than this does not fit. */
  readonly maxWorkpieceThicknessMm: number;
};

export type FeasibilityInput = {
  readonly widthMm: number;
  /**
   * `null` for a product with no catalog design at all - `CUSTOM`
   * (customer-uploaded artwork, P4). Line-width/spacing/detail-level
   * feasibility genuinely can't be evaluated against an unreviewed
   * upload; that's what design review (§13.3) is for. `null` simply
   * skips the three design-derived findings below rather than guessing.
   */
  readonly design: DesignConstraints | null;
  readonly material: MaterialConstraints;
  readonly moduleCount: number;
  readonly isFloorElement: boolean;
  /**
   * The chosen thickness, or `null` for a product type with no THICKNESS
   * step (§5) - WALL_ART and KITCHEN_TILE never supply one, and the check
   * is skipped rather than guessing a value that was never configured.
   */
  readonly thicknessMm: number | null;
  readonly machine: MachineConstraints;
};

export function evaluateFeasibility(
  input: FeasibilityInput,
): FeasibilityFinding[] {
  const findings: FeasibilityFinding[] = [];
  const { design, material } = input;

  // `design === null` (CUSTOM, no catalog design) skips all three
  // design-derived findings below entirely - see FeasibilityInput's
  // comment on why nothing here is guessed in its place.
  if (design !== null) {
    // Features scale with the product: a design drawn for 600 mm and produced
    // at 300 mm has every line at half its declared width.
    const scale = input.widthMm / design.referenceWidthMm;
    const effectiveLineWidthMm = round2(design.minLineWidthMm * scale);
    const effectiveSpacingMm = round2(design.minDetailSpacingMm * scale);

    if (effectiveLineWidthMm < material.minLineWidthMm) {
      findings.push({
        code: 'LINE_TOO_THIN',
        severity: 'error',
        requiresAcknowledgement: false,
        params: {
          effectiveLineWidthMm,
          requiredMm: material.minLineWidthMm,
        },
      });
    }

    if (effectiveSpacingMm < material.minDetailSpacingMm) {
      findings.push({
        code: 'DETAIL_SPACING_TOO_TIGHT',
        severity: 'error',
        requiresAcknowledgement: false,
        params: {
          effectiveSpacingMm,
          requiredMm: material.minDetailSpacingMm,
        },
      });
    }

    if (design.detailLevel >= 4 && input.widthMm < design.minRecommendedWidthMm) {
      findings.push({
        code: 'DESIGN_TOO_DETAILED',
        severity: 'warning',
        requiresAcknowledgement: true,
        params: {
          widthMm: input.widthMm,
          recommendedMinWidthMm: design.minRecommendedWidthMm,
        },
      });
    }
  }

  if (input.thicknessMm !== null && input.thicknessMm > input.machine.maxWorkpieceThicknessMm) {
    findings.push({
      code: 'THICKNESS_EXCEEDS_MACHINE',
      severity: 'error',
      requiresAcknowledgement: false,
      params: {
        thicknessMm: input.thicknessMm,
        maxThicknessMm: input.machine.maxWorkpieceThicknessMm,
      },
    });
  }

  if (input.moduleCount > 1) {
    findings.push({
      code: 'MODULAR_BUILD',
      severity: 'notice',
      requiresAcknowledgement: false,
      params: { moduleCount: input.moduleCount },
    });
  }

  if (material.isNaturalVariable) {
    findings.push({
      code: 'NATURAL_VARIATION',
      severity: 'notice',
      requiresAcknowledgement: false,
      params: {},
    });
  }

  if (input.isFloorElement) {
    findings.push({
      code: 'FLOOR_MATCH_NOT_GUARANTEED',
      severity: 'warning',
      requiresAcknowledgement: true,
      params: {},
    });
  }

  return findings;
}

export function hasBlockingError(findings: readonly FeasibilityFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'error');
}

export function acknowledgementsRequired(
  findings: readonly FeasibilityFinding[],
): FeasibilityCode[] {
  return findings
    .filter((finding) => finding.requiresAcknowledgement)
    .map((finding) => finding.code);
}

/**
 * True when every warning that needs acknowledging has been acknowledged and
 * nothing is blocking. This is the gate on add-to-cart.
 */
export function canProceed(
  findings: readonly FeasibilityFinding[],
  acknowledged: readonly FeasibilityCode[],
): boolean {
  if (hasBlockingError(findings)) {
    return false;
  }
  const outstanding = acknowledgementsRequired(findings).filter(
    (code) => !acknowledged.includes(code),
  );
  return outstanding.length === 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

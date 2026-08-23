/**
 * Dimension validation.
 *
 * Every length in this codebase is an integer number of millimetres. The
 * customer types centimetres; `text/numeric-input` converts. By the time a
 * value reaches this module it must already be integer mm, and a non-integer
 * here is a programming error worth reporting rather than rounding away.
 */

export type DimensionEnvelope = {
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
  /** width / height. e.g. 0.2 forbids a 20 x 100 cm sliver. */
  readonly minAspectRatio?: number | null;
  /** width / height. e.g. 5 forbids a 300 x 60 cm sliver. */
  readonly maxAspectRatio?: number | null;
};

export type Dimensions = {
  readonly widthMm: number;
  readonly heightMm: number;
};

export type DimensionIssueCode =
  | 'WIDTH_NOT_INTEGER'
  | 'HEIGHT_NOT_INTEGER'
  | 'WIDTH_NOT_POSITIVE'
  | 'HEIGHT_NOT_POSITIVE'
  | 'WIDTH_BELOW_MIN'
  | 'WIDTH_ABOVE_MAX'
  | 'HEIGHT_BELOW_MIN'
  | 'HEIGHT_ABOVE_MAX'
  | 'ASPECT_RATIO_TOO_NARROW'
  | 'ASPECT_RATIO_TOO_WIDE';

export type DimensionIssue = {
  readonly code: DimensionIssueCode;
  readonly actual: number;
  readonly limit?: number;
};

/**
 * Returns every issue with the given dimensions. An empty array means valid.
 *
 * Axis range checks are skipped when that axis is not a positive integer, so a
 * customer who types nonsense gets one clear message instead of four.
 */
export function validateDimensions(
  dimensions: Dimensions,
  envelope: DimensionEnvelope,
): DimensionIssue[] {
  const issues: DimensionIssue[] = [];
  const { widthMm, heightMm } = dimensions;

  const widthUsable = checkAxis(
    widthMm,
    'WIDTH_NOT_INTEGER',
    'WIDTH_NOT_POSITIVE',
    issues,
  );
  const heightUsable = checkAxis(
    heightMm,
    'HEIGHT_NOT_INTEGER',
    'HEIGHT_NOT_POSITIVE',
    issues,
  );

  if (widthUsable) {
    if (widthMm < envelope.minWidthMm) {
      issues.push({
        code: 'WIDTH_BELOW_MIN',
        actual: widthMm,
        limit: envelope.minWidthMm,
      });
    } else if (widthMm > envelope.maxWidthMm) {
      issues.push({
        code: 'WIDTH_ABOVE_MAX',
        actual: widthMm,
        limit: envelope.maxWidthMm,
      });
    }
  }

  if (heightUsable) {
    if (heightMm < envelope.minHeightMm) {
      issues.push({
        code: 'HEIGHT_BELOW_MIN',
        actual: heightMm,
        limit: envelope.minHeightMm,
      });
    } else if (heightMm > envelope.maxHeightMm) {
      issues.push({
        code: 'HEIGHT_ABOVE_MAX',
        actual: heightMm,
        limit: envelope.maxHeightMm,
      });
    }
  }

  if (widthUsable && heightUsable) {
    const ratio = widthMm / heightMm;
    const min = envelope.minAspectRatio;
    const max = envelope.maxAspectRatio;

    if (typeof min === 'number' && ratio < min) {
      issues.push({ code: 'ASPECT_RATIO_TOO_NARROW', actual: ratio, limit: min });
    } else if (typeof max === 'number' && ratio > max) {
      issues.push({ code: 'ASPECT_RATIO_TOO_WIDE', actual: ratio, limit: max });
    }
  }

  return issues;
}

export function isValidDimensions(
  dimensions: Dimensions,
  envelope: DimensionEnvelope,
): boolean {
  return validateDimensions(dimensions, envelope).length === 0;
}

/** Surface area in square millimetres. */
export function areaMm2(dimensions: Dimensions): number {
  return dimensions.widthMm * dimensions.heightMm;
}

function checkAxis(
  value: number,
  notIntegerCode: DimensionIssueCode,
  notPositiveCode: DimensionIssueCode,
  issues: DimensionIssue[],
): boolean {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    issues.push({ code: notIntegerCode, actual: value });
    return false;
  }
  if (value <= 0) {
    issues.push({ code: notPositiveCode, actual: value });
    return false;
  }
  return true;
}

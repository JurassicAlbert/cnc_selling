import { describe, expect, it } from 'vitest';

import type { DimensionEnvelope } from '@/domain/dimensions/dimensions';
import {
  areaMm2,
  isValidDimensions,
  validateDimensions,
} from '@/domain/dimensions/dimensions';

/** A wall-art envelope: 20x20 cm to 150x150 cm, no sliver shapes. */
const ENVELOPE: DimensionEnvelope = {
  minWidthMm: 200,
  maxWidthMm: 1500,
  minHeightMm: 200,
  maxHeightMm: 1500,
  minAspectRatio: 0.25,
  maxAspectRatio: 4,
};

function codes(dimensions: { widthMm: number; heightMm: number }): string[] {
  return validateDimensions(dimensions, ENVELOPE).map((issue) => issue.code);
}

describe('validateDimensions — valid cases', () => {
  it('accepts a mid-range size', () => {
    expect(codes({ widthMm: 600, heightMm: 900 })).toEqual([]);
  });

  it('accepts exactly the minimum on both axes', () => {
    expect(codes({ widthMm: 200, heightMm: 200 })).toEqual([]);
  });

  it('accepts exactly the maximum on both axes', () => {
    expect(codes({ widthMm: 1500, heightMm: 1500 })).toEqual([]);
  });

  it('accepts a ratio exactly at the narrow limit', () => {
    // 300 / 1200 = 0.25
    expect(codes({ widthMm: 300, heightMm: 1200 })).toEqual([]);
  });

  it('accepts a ratio exactly at the wide limit', () => {
    // 1200 / 300 = 4
    expect(codes({ widthMm: 1200, heightMm: 300 })).toEqual([]);
  });
});

describe('validateDimensions — range violations', () => {
  it('rejects a width one millimetre below the minimum', () => {
    expect(codes({ widthMm: 199, heightMm: 400 })).toEqual(['WIDTH_BELOW_MIN']);
  });

  it('rejects a width one millimetre above the maximum', () => {
    expect(codes({ widthMm: 1501, heightMm: 400 })).toContain('WIDTH_ABOVE_MAX');
  });

  it('rejects a height below the minimum', () => {
    expect(codes({ widthMm: 400, heightMm: 199 })).toEqual(['HEIGHT_BELOW_MIN']);
  });

  it('rejects a height above the maximum', () => {
    expect(codes({ widthMm: 400, heightMm: 1501 })).toContain('HEIGHT_ABOVE_MAX');
  });

  it('reports both axes when both are out of range', () => {
    const result = codes({ widthMm: 10, heightMm: 9000 });
    expect(result).toContain('WIDTH_BELOW_MIN');
    expect(result).toContain('HEIGHT_ABOVE_MAX');
  });

  it('reports the actual value and the limit so the message can be specific', () => {
    const issues = validateDimensions({ widthMm: 199, heightMm: 400 }, ENVELOPE);
    expect(issues).toEqual([
      { code: 'WIDTH_BELOW_MIN', actual: 199, limit: 200 },
    ]);
  });
});

describe('validateDimensions — aspect ratio', () => {
  it('rejects an extremely tall sliver', () => {
    // 250 / 1400 = 0.178...
    expect(codes({ widthMm: 250, heightMm: 1400 })).toContain(
      'ASPECT_RATIO_TOO_NARROW',
    );
  });

  it('rejects an extremely wide sliver', () => {
    expect(codes({ widthMm: 1400, heightMm: 250 })).toContain(
      'ASPECT_RATIO_TOO_WIDE',
    );
  });

  it('skips the ratio check when the envelope does not constrain it', () => {
    const unconstrained: DimensionEnvelope = {
      minWidthMm: 10,
      maxWidthMm: 5000,
      minHeightMm: 10,
      maxHeightMm: 5000,
      minAspectRatio: null,
      maxAspectRatio: null,
    };
    expect(validateDimensions({ widthMm: 4000, heightMm: 20 }, unconstrained)).toEqual(
      [],
    );
  });
});

describe('validateDimensions — invalid input', () => {
  it('rejects zero', () => {
    expect(codes({ widthMm: 0, heightMm: 400 })).toEqual(['WIDTH_NOT_POSITIVE']);
  });

  it('rejects a negative dimension', () => {
    expect(codes({ widthMm: 400, heightMm: -1 })).toEqual([
      'HEIGHT_NOT_POSITIVE',
    ]);
  });

  it('rejects a fractional millimetre', () => {
    expect(codes({ widthMm: 400.5, heightMm: 400 })).toEqual([
      'WIDTH_NOT_INTEGER',
    ]);
  });

  it('rejects NaN', () => {
    expect(codes({ widthMm: Number.NaN, heightMm: 400 })).toEqual([
      'WIDTH_NOT_INTEGER',
    ]);
  });

  it('rejects Infinity', () => {
    expect(codes({ widthMm: 400, heightMm: Number.POSITIVE_INFINITY })).toEqual([
      'HEIGHT_NOT_INTEGER',
    ]);
  });

  it('does not pile range errors on top of an unusable value', () => {
    // One clear message, not "not an integer" AND "below minimum".
    expect(codes({ widthMm: Number.NaN, heightMm: 400 })).toHaveLength(1);
  });
});

describe('isValidDimensions and areaMm2', () => {
  it('summarises validity as a boolean', () => {
    expect(isValidDimensions({ widthMm: 600, heightMm: 900 }, ENVELOPE)).toBe(true);
    expect(isValidDimensions({ widthMm: 6, heightMm: 900 }, ENVELOPE)).toBe(false);
  });

  it('computes area in square millimetres', () => {
    expect(areaMm2({ widthMm: 1000, heightMm: 1000 })).toBe(1_000_000);
  });
});

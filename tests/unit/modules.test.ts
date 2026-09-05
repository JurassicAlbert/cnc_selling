import { describe, expect, it } from 'vitest';

import type { ModuleLayout, SplitLimits } from '@/domain/modules/split';
import { distribute, rowLabel, splitIntoModules } from '@/domain/modules/split';

/** 600 x 900 mm machine, clamped to a usable 580 x 880 with tool clearance. */
const LIMITS: SplitLimits = {
  usableWidthMm: 580,
  usableHeightMm: 880,
  minModuleMm: 150,
};

function layoutOf(widthMm: number, heightMm: number, limits = LIMITS): ModuleLayout {
  const result = splitIntoModules(widthMm, heightMm, limits);
  if (!result.ok) {
    throw new Error(`expected a layout, got ${result.code}: ${result.detail}`);
  }
  return result.layout;
}

describe('splitIntoModules - single module', () => {
  it('produces one module for a product well inside the usable area', () => {
    const layout = layoutOf(400, 600);
    expect(layout.totalModules).toBe(1);
    expect(layout.isModular).toBe(false);
    expect(layout.modules).toHaveLength(1);
  });

  it('produces ONE module at exactly the usable width - the classic off-by-one', () => {
    const layout = layoutOf(580, 880);
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.totalModules).toBe(1);
  });

  it('produces two columns one millimetre over the usable width', () => {
    const layout = layoutOf(581, 880);
    expect(layout.cols).toBe(2);
    expect(layout.totalModules).toBe(2);
  });

  it('produces one module for a product smaller than the minimum module size', () => {
    // A 70 x 120 mm kitchen tile is below minModuleMm, but that limit governs
    // splitting, not product size.
    const layout = layoutOf(70, 120);
    expect(layout.totalModules).toBe(1);
  });
});

describe('splitIntoModules - the 120 x 120 cm case from the brief', () => {
  const layout = layoutOf(1200, 1200);

  it('splits into a 3 x 2 grid on this machine', () => {
    // 1200 / 580 -> 3 columns; 1200 / 880 -> 2 rows.
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(2);
    expect(layout.totalModules).toBe(6);
    expect(layout.isModular).toBe(true);
  });

  it('names modules by row letter and column number', () => {
    expect(layout.modules.map((m) => m.code)).toEqual([
      'A1',
      'A2',
      'A3',
      'B1',
      'B2',
      'B3',
    ]);
  });

  it('orders production row-major', () => {
    expect(layout.modules.map((m) => m.productionOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gives every module a global offset so the seams align', () => {
    const first = layout.modules.find((m) => m.code === 'A1');
    const b2 = layout.modules.find((m) => m.code === 'B2');
    expect(first).toMatchObject({ xMm: 0, yMm: 0 });
    expect(b2?.xMm).toBe(400);
    expect(b2?.yMm).toBe(600);
  });

  it('keeps every module inside the usable area', () => {
    for (const module of layout.modules) {
      expect(module.widthMm).toBeLessThanOrEqual(LIMITS.usableWidthMm);
      expect(module.heightMm).toBeLessThanOrEqual(LIMITS.usableHeightMm);
    }
  });
});

describe('splitIntoModules - the pieces must reconstruct the product exactly', () => {
  const cases: ReadonlyArray<readonly [number, number]> = [
    [1200, 1200],
    [1000, 700],
    [581, 881],
    [2399, 1777],
    [70, 120],
    [1739, 1201],
  ];

  it.each(cases)('reassembles %i x %i mm with no gap and no overlap', (w, h) => {
    const layout = layoutOf(w, h);

    const topRow = layout.modules.filter((m) => m.row === 0);
    const leftCol = layout.modules.filter((m) => m.col === 0);

    expect(topRow.reduce((sum, m) => sum + m.widthMm, 0)).toBe(w);
    expect(leftCol.reduce((sum, m) => sum + m.heightMm, 0)).toBe(h);

    const totalArea = layout.modules.reduce(
      (sum, m) => sum + m.widthMm * m.heightMm,
      0,
    );
    expect(totalArea).toBe(w * h);
  });
});

describe('splitIntoModules - sliver avoidance', () => {
  it('never produces a module below the minimum size when it can be avoided', () => {
    const layout = layoutOf(1170, 500);
    for (const module of layout.modules) {
      expect(module.widthMm).toBeGreaterThanOrEqual(LIMITS.minModuleMm);
    }
  });

  it('keeps modules within one millimetre of each other', () => {
    const layout = layoutOf(1739, 500);
    const widths = layout.modules.filter((m) => m.row === 0).map((m) => m.widthMm);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });

  it('reduces the count rather than emitting a sliver', () => {
    // 620 mm with a 400 mm minimum: two modules would be 310 mm each, below the
    // minimum, so it must fall back to... nothing valid, since 620 > 580 usable.
    const result = splitIntoModules(620, 400, {
      usableWidthMm: 580,
      usableHeightMm: 880,
      minModuleMm: 400,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INFEASIBLE_MODULE_SIZE');
    }
  });
});

describe('splitIntoModules - invalid input', () => {
  it('rejects a zero dimension', () => {
    const result = splitIntoModules(0, 500, LIMITS);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DIMENSIONS' });
  });

  it('rejects a fractional dimension', () => {
    const result = splitIntoModules(500.5, 500, LIMITS);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DIMENSIONS' });
  });

  it('rejects a negative dimension', () => {
    const result = splitIntoModules(-500, 500, LIMITS);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DIMENSIONS' });
  });

  it('rejects limits where the minimum module exceeds the machine', () => {
    const result = splitIntoModules(1000, 1000, {
      usableWidthMm: 580,
      usableHeightMm: 880,
      minModuleMm: 900,
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_LIMITS' });
  });

  it('rejects a zero usable area', () => {
    const result = splitIntoModules(1000, 1000, {
      usableWidthMm: 0,
      usableHeightMm: 880,
      minModuleMm: 150,
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_LIMITS' });
  });
});

describe('splitIntoModules - a larger machine makes the same product one piece', () => {
  it('produces a single module when the machine can take it', () => {
    const layout = layoutOf(1200, 1200, {
      usableWidthMm: 1500,
      usableHeightMm: 3000,
      minModuleMm: 150,
    });
    expect(layout.totalModules).toBe(1);
    expect(layout.isModular).toBe(false);
  });
});

describe('distribute', () => {
  it('splits evenly when it divides', () => {
    expect(distribute(1200, 3)).toEqual([400, 400, 400]);
  });

  it('spreads the remainder one millimetre at a time', () => {
    expect(distribute(1201, 3)).toEqual([401, 400, 400]);
    expect(distribute(1202, 3)).toEqual([401, 401, 400]);
  });

  it('always sums to the original length', () => {
    for (const total of [1, 7, 999, 1739, 2400]) {
      for (const parts of [1, 2, 3, 5, 7]) {
        const sizes = distribute(total, parts);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
        expect(sizes).toHaveLength(parts);
      }
    }
  });
});

describe('rowLabel', () => {
  it('labels the first 26 rows with single letters', () => {
    expect(rowLabel(0)).toBe('A');
    expect(rowLabel(1)).toBe('B');
    expect(rowLabel(25)).toBe('Z');
  });

  it('continues past Z with two letters', () => {
    expect(rowLabel(26)).toBe('AA');
    expect(rowLabel(27)).toBe('AB');
    expect(rowLabel(51)).toBe('AZ');
    expect(rowLabel(52)).toBe('BA');
  });
});

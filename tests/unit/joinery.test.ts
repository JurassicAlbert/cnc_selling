import { describe, expect, it } from 'vitest';

import { buildJoineryFinding, JOINERY_TECHNIQUE_YATO_YANE } from '@/domain/joinery/yato-yane';
import type { SplitLimits } from '@/domain/modules/split';
import { splitIntoModules } from '@/domain/modules/split';

describe('buildJoineryFinding', () => {
  it('returns null for a single, unjoined panel', () => {
    expect(buildJoineryFinding(1)).toBeNull();
  });

  it('returns null for zero modules (defensive - never a valid layout)', () => {
    expect(buildJoineryFinding(0)).toBeNull();
  });

  it('returns a notice-severity finding naming the technique for a joined panel', () => {
    const finding = buildJoineryFinding(4);
    expect(finding).not.toBeNull();
    expect(finding).toEqual({
      code: 'JOINED_PANEL_YATO_YANE',
      severity: 'notice',
      requiresAcknowledgement: false,
      params: { moduleCount: 4, technique: JOINERY_TECHNIQUE_YATO_YANE },
    });
  });
});

describe('joinery composes with the existing module-split system', () => {
  /** The seeded machine limits (prisma/seed.ts's MachineSettings row). */
  const SEEDED_MACHINE_LIMITS: SplitLimits = {
    usableWidthMm: 600,
    usableHeightMm: 500,
    minModuleMm: 150,
  };

  it('a doubled loft-table size (1200x1000) splits into a 2x2 grid of 600x500 panels', () => {
    const result = splitIntoModules(1200, 1000, SEEDED_MACHINE_LIMITS);
    if (!result.ok) {
      throw new Error(`expected a layout, got ${result.code}: ${result.detail}`);
    }
    expect(result.layout.cols).toBe(2);
    expect(result.layout.rows).toBe(2);
    expect(result.layout.totalModules).toBe(4);

    const finding = buildJoineryFinding(result.layout.totalModules);
    expect(finding?.params).toEqual({ moduleCount: 4, technique: JOINERY_TECHNIQUE_YATO_YANE });
  });
});

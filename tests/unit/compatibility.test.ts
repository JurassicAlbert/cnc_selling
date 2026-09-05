import { describe, expect, it } from 'vitest';

import {
  availableDesigns,
  availableFinishes,
  availableMaterials,
  availableThicknesses,
} from '@/domain/compatibility/resolve';

/**
 * §7.2 of the architecture doc: each configurator step's options are the
 * already-filtered result of a pure function, not a hidden option and not a
 * client-side guess. Every function here takes rows the mapper already
 * fetched - no DB, no I/O - and decides which subset is actually offered.
 */

describe('availableMaterials', () => {
  const materials = [
    { materialId: 'dab', isAvailable: true },
    { materialId: 'buk', isAvailable: true },
    { materialId: 'jesion', isAvailable: false },
  ];

  it('excludes materials the catalogue marked unavailable', () => {
    expect(availableMaterials(materials)).toEqual(['dab', 'buk']);
  });

  it('returns everything available when nothing narrows it', () => {
    expect(availableMaterials(materials, [])).toEqual(['dab', 'buk']);
  });

  it('narrows to the design’s allowed materials when the design restricts them', () => {
    expect(availableMaterials(materials, ['buk'])).toEqual(['buk']);
  });

  it('drops a design-allowed material that the catalogue also marked unavailable', () => {
    // jesion is design-allowed but catalogue-unavailable: still excluded.
    expect(availableMaterials(materials, ['jesion', 'buk'])).toEqual(['buk']);
  });

  it('returns nothing when the design narrows to materials that do not exist here', () => {
    expect(availableMaterials(materials, ['nieznany'])).toEqual([]);
  });

  it('returns nothing when there are no materials to offer at all', () => {
    expect(availableMaterials([])).toEqual([]);
  });
});

describe('availableFinishes', () => {
  it('excludes finishes unavailable on the catalogue', () => {
    const finishes = [
      { finishId: 'olejowanie', isAvailable: true },
      { finishId: 'lakierowanie', isAvailable: false },
    ];
    expect(availableFinishes(finishes)).toEqual(['olejowanie']);
  });

  it('returns nothing when the material has no compatible finishes at all', () => {
    // A material with no MaterialFinish rows offers no finish - never treated
    // as "everything is compatible", unlike the material/design narrowing
    // rule. There is no MaterialFinish equivalent of "empty means all".
    expect(availableFinishes([])).toEqual([]);
  });
});

describe('availableDesigns', () => {
  const designs = [
    {
      designId: 'linoryt-01',
      isActive: true,
      rightsStatus: 'APPROVED_COMMERCIAL' as const,
      allowedMaterialIds: [],
    },
    {
      designId: 'linoryt-02',
      isActive: true,
      rightsStatus: 'PUBLIC_DOMAIN' as const,
      allowedMaterialIds: ['dab'],
    },
    {
      designId: 'linoryt-03',
      isActive: true,
      rightsStatus: 'REQUIRES_PERMISSION' as const,
      allowedMaterialIds: [],
    },
    {
      designId: 'linoryt-04',
      isActive: false,
      rightsStatus: 'APPROVED_COMMERCIAL' as const,
      allowedMaterialIds: [],
    },
    {
      designId: 'linoryt-05',
      isActive: true,
      rightsStatus: 'RESTRICTED' as const,
      allowedMaterialIds: [],
    },
    {
      designId: 'linoryt-06',
      isActive: true,
      rightsStatus: 'CUSTOMER_SUPPLIED' as const,
      allowedMaterialIds: [],
    },
  ];

  it('offers only APPROVED_COMMERCIAL and PUBLIC_DOMAIN designs, never the other rights statuses', () => {
    // No material chosen yet: linoryt-01 and linoryt-02 pass on rights alone.
    // REQUIRES_PERMISSION, RESTRICTED and CUSTOMER_SUPPLIED are never sellable,
    // regardless of activity or material narrowing - brief §12.
    expect(availableDesigns(designs, null)).toEqual(['linoryt-01', 'linoryt-02']);
  });

  it('excludes an inactive design even if its rights status would otherwise sell', () => {
    expect(availableDesigns(designs, null)).not.toContain('linoryt-04');
  });

  it('treats an empty DesignMaterial narrowing list as "every material the product allows"', () => {
    // linoryt-01 has no DesignMaterial rows, so it must be offered no matter
    // which material is selected - the schema's own comment on
    // Design.materials is explicit about this.
    expect(availableDesigns(designs, 'jesion')).toContain('linoryt-01');
  });

  it('excludes a design narrowed to materials that do not include the selected one', () => {
    expect(availableDesigns(designs, 'buk')).not.toContain('linoryt-02');
  });

  it('includes a narrowed design when the selected material is in its allowed list', () => {
    expect(availableDesigns(designs, 'dab')).toContain('linoryt-02');
  });
});

describe('availableThicknesses', () => {
  const thicknesses = [{ thicknessMm: 18 }, { thicknessMm: 27 }, { thicknessMm: 40 }];

  it('offers every thickness when the variant has no cap', () => {
    expect(availableThicknesses(thicknesses, null)).toEqual([18, 27, 40]);
  });

  it('excludes thicknesses above the installation variant’s cap', () => {
    // OVERLAY variants are thickness-constrained by definition (§6.5).
    expect(availableThicknesses(thicknesses, 27)).toEqual([18, 27]);
  });

  it('includes a thickness exactly at the cap, not just strictly below it', () => {
    expect(availableThicknesses(thicknesses, 18)).toEqual([18]);
  });

  it('returns nothing when every thickness exceeds the cap', () => {
    expect(availableThicknesses(thicknesses, 10)).toEqual([]);
  });
});

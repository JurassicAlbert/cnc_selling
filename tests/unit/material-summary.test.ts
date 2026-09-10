import { describe, expect, it } from 'vitest';

import { summariseMaterials } from '@/domain/catalogue/material-summary';

/**
 * `docs/AI-CHECKLIST.md` UX-17.
 *
 * The card said „Dąb +3", which is developer shorthand nobody outside the
 * repository reads as "four kinds of wood". The item proposes „4 gatunki
 * drewna" - and that phrase is only true for some products.
 *
 * The seeded catalogue settles it: `fartuch-kuchenny-z-grawerem` offers
 * exactly one material and it is **Gres biały, family `CERAMIC`**. The schema
 * also allows `PLYWOOD`, `MDF`, `LEATHER` and `OTHER`. Calling any of those a
 * „gatunek drewna" would be the plain kind of lie the owner ruled out, so the
 * summary is decided from the families rather than from the count alone.
 *
 * Plywood and MDF are deliberately NOT wood here. They are wood-derived
 * boards, not species, and „gatunek" means species.
 */
describe('summariseMaterials', () => {
  const oak = { namePl: 'Dąb', family: 'SOLID_WOOD' } as const;
  const spruce = { namePl: 'Świerk', family: 'SOLID_WOOD' } as const;
  const larch = { namePl: 'Modrzew', family: 'SOLID_WOOD' } as const;
  const gres = { namePl: 'Gres biały', family: 'CERAMIC' } as const;

  it('says nothing when there is nothing to say', () => {
    expect(summariseMaterials([])).toEqual({ kind: 'none' });
  });

  it('names the material when there is only one, because the name beats a count', () => {
    // „1 materiał" would be strictly less useful than „Gres biały".
    expect(summariseMaterials([gres])).toEqual({ kind: 'single', namePl: 'Gres biały' });
    expect(summariseMaterials([oak])).toEqual({ kind: 'single', namePl: 'Dąb' });
  });

  it('counts species when every option really is solid wood', () => {
    expect(summariseMaterials([oak, spruce, larch])).toEqual({ kind: 'wood', count: 3 });
  });

  it('refuses to call a mixed set wood', () => {
    // One ceramic option in the list and the sentence „3 gatunki drewna"
    // stops being true. The count is still worth saying; the word is not.
    expect(summariseMaterials([oak, spruce, gres])).toEqual({ kind: 'mixed', count: 3 });
  });

  it('refuses to call a board a species', () => {
    // Plywood and MDF are wood-derived, and neither is a „gatunek".
    expect(summariseMaterials([oak, { namePl: 'Sklejka', family: 'PLYWOOD' }])).toEqual({ kind: 'mixed', count: 2 });
    expect(summariseMaterials([oak, { namePl: 'MDF', family: 'MDF' }])).toEqual({ kind: 'mixed', count: 2 });
  });
});

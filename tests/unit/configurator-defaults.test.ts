/**
 * `computeDefaultSelections` - the configurator's starting configuration.
 *
 * It exists because of owner feedback ("The price for the product should be
 * clear, no waiting for configure"), so a product page shows a real price on
 * first render instead of an empty placeholder. That makes it the one place
 * where the application chooses selections **on the customer's behalf**, and
 * therefore the one place where choosing a field the product type does not
 * have would produce a page that prices fine and then refuses to add to the
 * cart - the exact shape the owner ruled out on 2026-08-31.
 *
 * That was not hypothetical when BUG-06 landed. It filled `finishId` from
 * the material's first available finish for *every* product, and `JEWELRY`
 * has no FINISH step (§5) - so the bracelet would have defaulted to a finish
 * it is not allowed to carry, priced happily, and been rejected by the new
 * write-path check the moment anyone pressed "Dodaj do koszyka".
 *
 * Exported from the component module solely so this can exist. The rule is
 * only worth anything if something checks it.
 */

import { describe, expect, it } from 'vitest';

import { computeDefaultSelections } from '@/ui/islands/configurator/selections';
import { findSelectionOutsideProductType, stepsForProductType } from '@/domain/configuration/steps';
import type { ProductTypeCode } from '@/domain/configuration/steps';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';

const ALL_PRODUCT_TYPES: readonly ProductTypeCode[] = [
  'WALL_ART',
  'TABLE_TOP',
  'KITCHEN_TILE',
  'FLOOR_ELEMENT',
  'CUSTOM',
  'LOFT_FURNITURE',
  'JEWELRY',
];

/** A product that offers something for every step, so nothing is skipped for lack of options. */
function optionsWithEverything(): ConfiguratorOptionData {
  return {
    materials: [
      {
        id: 'material-1',
        namePl: 'Dąb',
        imageUrl: '/m.jpg',
        isAvailable: true,
        finishes: [
          { id: 'finish-1', namePl: 'Olejowanie', isAvailable: true, imageUrl: '/f.jpg' },
        ],
      },
    ],
    designs: [
      {
        id: 'design-1',
        namePl: 'Gałązka oliwna',
        isActive: true,
        rightsStatus: 'APPROVED_COMMERCIAL',
        allowedMaterialIds: [],
        previewUrl: '/d.svg',
      },
    ],
    thicknesses: [{ thicknessMm: 18, labelPl: '18 mm' }],
    installVariants: [
      {
        code: 'FULL_WALL',
        namePl: 'Cała ściana',
        descPl: '.',
        receivesPl: '.',
        diagramUrl: '/i.svg',
        maxThicknessMm: null,
      },
    ],
    fonts: [{ id: 'font-1', namePl: 'Inter', fileUrl: '/f.woff2' }],
    presetSizes: [
      { id: 'size-1', widthMm: 200, heightMm: 200, labelPl: 'Mały' },
      { id: 'size-2', widthMm: 400, heightMm: 400, labelPl: 'Średni' },
      { id: 'size-3', widthMm: 600, heightMm: 600, labelPl: 'Duży' },
    ],
  } as ConfiguratorOptionData;
}

describe('computeDefaultSelections never chooses a step the product type does not have', () => {
  it.each(ALL_PRODUCT_TYPES)('%s', (productType) => {
    const defaults = computeDefaultSelections(optionsWithEverything(), productType);

    // The same function the write path uses, so this test and
    // `priceAndValidateSelections` cannot disagree about the rule.
    expect(findSelectionOutsideProductType(stepsForProductType(productType), defaults)).toBeNull();
  });

  it('does not default a finish for JEWELRY, which has no FINISH step', () => {
    // The concrete regression: the seeded bracelet's oak offers oiling, so
    // before this the default carried a finishId the product type forbids.
    expect(computeDefaultSelections(optionsWithEverything(), 'JEWELRY').finishId).toBeNull();
    expect(computeDefaultSelections(optionsWithEverything(), 'WALL_ART').finishId).toBe('finish-1');
  });

  it('does not default a design for CUSTOM, whose artwork is the customer’s upload', () => {
    expect(computeDefaultSelections(optionsWithEverything(), 'CUSTOM').designId).toBeNull();
    expect(computeDefaultSelections(optionsWithEverything(), 'WALL_ART').designId).toBe('design-1');
  });
});

describe('computeDefaultSelections still produces a priceable starting point', () => {
  it('fills material and the middle preset size for every product type', () => {
    // Regression guard on the owner's actual requirement: a real price on
    // first render. Narrowing the defaults must not empty them.
    for (const productType of ALL_PRODUCT_TYPES) {
      const defaults = computeDefaultSelections(optionsWithEverything(), productType);
      expect(defaults.materialId).toBe('material-1');
      // Three presets -> index 1, the middle one. Chosen deliberately: the
      // smallest preset on a real product was too small for its design's
      // minimum line width, so defaulting to it opened on a warning.
      expect(defaults.widthMm).toBe(400);
      expect(defaults.heightMm).toBe(400);
    }
  });

  it('leaves size empty when the product offers no presets', () => {
    const noPresets = { ...optionsWithEverything(), presetSizes: [] } as ConfiguratorOptionData;
    const defaults = computeDefaultSelections(noPresets, 'FLOOR_ELEMENT');

    expect(defaults.widthMm).toBeNull();
    expect(defaults.heightMm).toBeNull();
  });
});

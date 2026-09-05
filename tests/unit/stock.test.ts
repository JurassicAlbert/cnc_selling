/**
 * The warehouse domain, requested by the owner on 2026-09-04: track the
 * boards actually held in stock, so the shop can answer three questions it
 * currently cannot.
 *
 *   1. What did this board really cost per square metre?
 *   2. What is the lowest price we could sell an item for without losing
 *      money on the material?
 *   3. Which catalogue items fit on this board, and how many of each?
 *
 * Pure on purpose, like `domain/pricing`: every rate is a parameter, nothing
 * reads a database. The units follow the project's existing conventions
 * exactly - integer grosze, integer millimetres - so these numbers compose
 * with `calculatePrice` rather than living beside it in a different currency.
 */

import { describe, expect, it } from 'vitest';

import {
  boardAreaMm2,
  boardCostPerM2Grosze,
  fitsOnBoard,
  howManyFitOnBoard,
  materialCostForItemGrosze,
  minimumViablePriceGrosze,
  stockMarginBp,
} from '@/domain/stock/board';

/** A real sheet size: 2000 x 1250 mm, 18 mm thick, bought for 320 zl net. */
const SHEET = { widthMm: 2000, heightMm: 1250, thicknessMm: 18, purchasePriceGrosze: 32_000 };

describe('boardAreaMm2', () => {
  it('multiplies the two dimensions', () => {
    expect(boardAreaMm2(SHEET)).toBe(2_500_000);
  });
});

describe('boardCostPerM2Grosze', () => {
  it('divides the purchase price by the real area', () => {
    // 2.5 m2 for 320 zl is 128 zl/m2.
    expect(boardCostPerM2Grosze(SHEET)).toBe(12_800);
  });

  it('rounds half up, like every other money figure in this project', () => {
    // 1 m2 board bought for 10.005 zl cannot be stored as a fraction.
    const board = { widthMm: 1000, heightMm: 1000, thicknessMm: 18, purchasePriceGrosze: 1001 };
    expect(boardCostPerM2Grosze(board)).toBe(1001);

    const half = { widthMm: 1000, heightMm: 500, thicknessMm: 18, purchasePriceGrosze: 1001 };
    // 0.5 m2 for 1001 grosze is 2002 grosze per m2.
    expect(boardCostPerM2Grosze(half)).toBe(2002);
  });

  it('refuses a board with no area rather than dividing by zero', () => {
    expect(() => boardCostPerM2Grosze({ ...SHEET, widthMm: 0 })).toThrow();
  });
});

describe('fitsOnBoard', () => {
  it('accepts an item smaller than the board', () => {
    expect(fitsOnBoard(SHEET, { widthMm: 600, heightMm: 400 })).toBe(true);
  });

  it('accepts an item that fits only when rotated', () => {
    // 1300 wide does not fit across a 1250 board, but does along its 2000 side.
    expect(fitsOnBoard(SHEET, { widthMm: 1300, heightMm: 900 })).toBe(true);
  });

  it('rejects an item larger than the board in both orientations', () => {
    expect(fitsOnBoard(SHEET, { widthMm: 2100, heightMm: 1300 })).toBe(false);
  });

  it('accepts an item exactly the size of the board', () => {
    expect(fitsOnBoard(SHEET, { widthMm: 2000, heightMm: 1250 })).toBe(true);
  });
});

describe('howManyFitOnBoard', () => {
  it('counts a simple grid', () => {
    // 500 x 250 on 2000 x 1250: 4 across, 5 down.
    expect(howManyFitOnBoard(SHEET, { widthMm: 500, heightMm: 250 })).toBe(20);
  });

  it('takes the better of the two orientations', () => {
    // 700 x 400 laid as-is: floor(2000/700)=2 by floor(1250/400)=3 -> 6.
    // Rotated: floor(2000/400)=5 by floor(1250/700)=1 -> 5. The larger wins.
    expect(howManyFitOnBoard(SHEET, { widthMm: 700, heightMm: 400 })).toBe(6);
  });

  it('returns zero when the item does not fit at all', () => {
    expect(howManyFitOnBoard(SHEET, { widthMm: 2100, heightMm: 100 })).toBe(0);
  });

  it('returns one for an item exactly the size of the board', () => {
    expect(howManyFitOnBoard(SHEET, { widthMm: 2000, heightMm: 1250 })).toBe(1);
  });

  /**
   * Deliberately a grid count, not a real nesting solver. A CNC shop
   * genuinely cuts in rows, and an optimal 2D packing is both NP-hard and
   * a promise this cannot keep: it would report a yield the operator cannot
   * actually achieve on the machine. Under-promising here is the honest
   * direction to be wrong in.
   */
  it('does not claim yields a row-by-row cut cannot deliver', () => {
    // An optimal packer would mix orientations and fit more than 6 here.
    expect(howManyFitOnBoard(SHEET, { widthMm: 700, heightMm: 400 })).toBe(6);
  });
});

describe('materialCostForItemGrosze', () => {
  it('charges the item its share of the board', () => {
    // One 500 x 250 piece is 0.125 m2. At 128 zl/m2 that is 16 zl.
    expect(materialCostForItemGrosze(SHEET, { widthMm: 500, heightMm: 250 })).toBe(1_600);
  });

  it('is the board price divided by the yield, for a board that divides evenly', () => {
    // 20 pieces out of a 320 zl board is 16 zl each, matching the area maths.
    const perPiece = materialCostForItemGrosze(SHEET, { widthMm: 500, heightMm: 250 });
    expect(perPiece * howManyFitOnBoard(SHEET, { widthMm: 500, heightMm: 250 })).toBe(
      SHEET.purchasePriceGrosze,
    );
  });

  it('refuses an item that does not fit on the board', () => {
    expect(() => materialCostForItemGrosze(SHEET, { widthMm: 3000, heightMm: 100 })).toThrow();
  });
});

describe('minimumViablePriceGrosze', () => {
  /**
   * The number the owner actually asked for: "what is the minimal price we
   * can give to consumer for creating item". It is the real material cost
   * plus every other real cost of making the piece, and nothing else - no
   * margin, no VAT. Selling at exactly this is breaking even.
   */
  it('adds the real material cost to the other production costs', () => {
    const price = minimumViablePriceGrosze({
      board: SHEET,
      itemSize: { widthMm: 500, heightMm: 250 },
      otherProductionCostGrosze: 4_000,
    });
    expect(price).toBe(5_600);
  });

  it('is the material cost alone when nothing else is spent', () => {
    const price = minimumViablePriceGrosze({
      board: SHEET,
      itemSize: { widthMm: 500, heightMm: 250 },
      otherProductionCostGrosze: 0,
    });
    expect(price).toBe(1_600);
  });

  it('refuses a negative production cost rather than quietly discounting', () => {
    expect(() =>
      minimumViablePriceGrosze({
        board: SHEET,
        itemSize: { widthMm: 500, heightMm: 250 },
        otherProductionCostGrosze: -1,
      }),
    ).toThrow();
  });
});

describe('stockMarginBp', () => {
  /**
   * What the shop charges for a material against what it paid. Basis points,
   * like every other rate here, so it composes with `applyFactorBp`.
   */
  it('reports the gap between the catalogue rate and the real cost', () => {
    // Charging 160 zl/m2 for material that cost 128 zl/m2 is a 25% margin.
    expect(stockMarginBp({ chargedPerM2Grosze: 16_000, costPerM2Grosze: 12_800 })).toBe(2_500);
  });

  it('is zero when the shop charges exactly what it paid', () => {
    expect(stockMarginBp({ chargedPerM2Grosze: 12_800, costPerM2Grosze: 12_800 })).toBe(0);
  });

  it('goes negative when the catalogue undercharges, rather than clamping', () => {
    // Selling at a loss is a real state and the panel has to be able to show
    // it. Hiding it behind a zero would be the whole point of this tool lost.
    expect(stockMarginBp({ chargedPerM2Grosze: 6_400, costPerM2Grosze: 12_800 })).toBe(-5_000);
  });

  it('returns null when nothing was paid, rather than dividing by zero', () => {
    expect(stockMarginBp({ chargedPerM2Grosze: 16_000, costPerM2Grosze: 0 })).toBeNull();
  });
});

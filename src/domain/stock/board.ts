/**
 * The warehouse maths, requested by the owner on 2026-09-04.
 *
 * The shop already knows what it *charges* for a material
 * (`Material.pricePerM2Grosze`, used by `domain/pricing`). It has never
 * known what it *paid*. Without that it cannot answer the question the owner
 * actually asked: "what is the minimal price we can give to consumer for
 * creating item, and how much materials we need to buy for how high price and
 * from where."
 *
 * This module is the arithmetic half of that. Pure, every input a parameter,
 * nothing reads a database - the same contract `domain/pricing` keeps, and
 * for the same reason: these numbers decide money, so they have to be
 * testable without a server.
 *
 * Units follow the project's existing conventions exactly. Integer grosze,
 * integer millimetres, rates in basis points. That is not decoration: it
 * means a cost from here can be added to a price from `calculatePrice`
 * without a conversion step where a rounding error could hide.
 */

import { assertInteger, assertNonNegative, divRoundHalfUp } from '@/domain/money/money';
import type { Grosze } from '@/domain/money/money';

/** A physical sheet as it arrives from the supplier. */
export type Board = {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly thicknessMm: number;
  /** Net, for one board of these dimensions. */
  readonly purchasePriceGrosze: Grosze;
};

/** The footprint of one finished item on the board. */
export type ItemSize = {
  readonly widthMm: number;
  readonly heightMm: number;
};

const MM2_PER_M2 = 1_000_000;

export function boardAreaMm2(board: Board): number {
  return board.widthMm * board.heightMm;
}

/**
 * What one square metre of this board really cost.
 *
 * Half-up rounding, matching `divRoundHalfUp` everywhere else in the project,
 * so a cost computed here and a price computed by `calculatePrice` round the
 * same way and can be compared without an off-by-one.
 */
export function boardCostPerM2Grosze(board: Board): Grosze {
  const areaMm2 = boardAreaMm2(board);
  if (areaMm2 <= 0) {
    throw new Error('board has no area - width and height must both be positive');
  }
  return divRoundHalfUp(board.purchasePriceGrosze * MM2_PER_M2, areaMm2);
}

/** Whether the item fits at all, in either orientation. */
export function fitsOnBoard(board: Board, item: ItemSize): boolean {
  const asIs = item.widthMm <= board.widthMm && item.heightMm <= board.heightMm;
  const rotated = item.heightMm <= board.widthMm && item.widthMm <= board.heightMm;
  return asIs || rotated;
}

/**
 * How many of the item come off one board, cutting in rows.
 *
 * Deliberately a grid count and not a nesting solver. A real 2D packing is
 * NP-hard, and more importantly it would report a yield the operator cannot
 * achieve: a CNC shop cuts in rows, and a number that assumes mixed
 * orientations and interlocked offcuts is a promise the machine will not
 * keep. Under-reporting is the honest direction to be wrong in, because the
 * figure feeds a *minimum* price.
 */
export function howManyFitOnBoard(board: Board, item: ItemSize): number {
  const grid = (itemWidth: number, itemHeight: number): number =>
    Math.floor(board.widthMm / itemWidth) * Math.floor(board.heightMm / itemHeight);

  if (item.widthMm <= 0 || item.heightMm <= 0) {
    return 0;
  }
  return Math.max(grid(item.widthMm, item.heightMm), grid(item.heightMm, item.widthMm));
}

/**
 * The material cost of one item, as its share of the board's area.
 *
 * Area rather than "board price divided by yield" on purpose: the yield is
 * whole pieces, so dividing by it would silently charge each piece for the
 * offcut as well. The offcut is real, but it is a separate decision (it can
 * be used for something smaller), and folding it into every item's cost
 * would inflate the minimum price for reasons the operator cannot see.
 */
export function materialCostForItemGrosze(board: Board, item: ItemSize): Grosze {
  if (!fitsOnBoard(board, item)) {
    throw new Error('item does not fit on this board in either orientation');
  }
  const itemAreaMm2 = item.widthMm * item.heightMm;
  return divRoundHalfUp(itemAreaMm2 * boardCostPerM2Grosze(board), MM2_PER_M2);
}

export type MinimumViablePriceInput = {
  readonly board: Board;
  readonly itemSize: ItemSize;
  /**
   * Everything else making one piece really costs: machine time, finish,
   * packaging, the operator's hour. Passed in rather than derived, because
   * this module has no business deciding what an hour is worth.
   */
  readonly otherProductionCostGrosze: Grosze;
};

/**
 * The lowest price that does not lose money on a piece.
 *
 * Net, with no margin and no VAT. Selling at exactly this figure breaks even,
 * which is what makes it useful as a floor to compare the catalogue price
 * against - not as a price to charge.
 */
export function minimumViablePriceGrosze(input: MinimumViablePriceInput): Grosze {
  assertInteger(input.otherProductionCostGrosze, 'otherProductionCostGrosze');
  assertNonNegative(input.otherProductionCostGrosze, 'otherProductionCostGrosze');
  return materialCostForItemGrosze(input.board, input.itemSize) + input.otherProductionCostGrosze;
}

/**
 * The gap between what the catalogue charges for a material and what it cost,
 * in basis points.
 *
 * Allowed to go negative. Selling below cost is a real state, and a warehouse
 * screen that clamped it to zero would hide the single thing this tool exists
 * to reveal. `null` means nothing was paid, so there is no margin to express.
 */
export function stockMarginBp(input: {
  readonly chargedPerM2Grosze: Grosze;
  readonly costPerM2Grosze: Grosze;
}): number | null {
  if (input.costPerM2Grosze <= 0) {
    return null;
  }
  return divRoundHalfUp((input.chargedPerM2Grosze - input.costPerM2Grosze) * 10_000, input.costPerM2Grosze);
}

/**
 * What an order takes off the shelf - `docs/AI-CHECKLIST.md` WAREHOUSE-01.
 *
 * `board.ts` answers "what can I make from this board and what did it cost".
 * This answers the other half the owner asked for on 2026-09-05: when an
 * order actually goes into production, which stock it comes out of.
 *
 * Two decisions are encoded here, both the owner's and both deliberately
 * placed in a pure module so a test can drive them. Either could otherwise
 * be "simplified" back by a future reader who did not know it was chosen:
 *
 * **Oldest batch first.** Offered cheapest-first and operator-picks. FIFO
 * won because it is how a physical stack is actually worked through, so the
 * cost recorded against an order is what was really on the shelf when the
 * piece was cut. Cheapest-first would minimise the reported cost while
 * detaching it from the boards that were actually there.
 *
 * **By area, not by whole boards.** A 2000x1250 board yields 240 coasters at
 * 100x100. Decrementing a whole board per order item would therefore be
 * wrong by a factor of 240 within days, and the checklist deferred this item
 * precisely because "guessing it would put wrong numbers into a cost report,
 * which is worse than having no report".
 *
 * The area rule has a real inaccuracy of its own and it is stated rather
 * than hidden: it treats every offcut as usable, so the shelf reads a few
 * percent fuller than it is. That was the trade accepted against typing a
 * board count on every order, and it errs optimistic by a little instead of
 * pessimistic by 24000%.
 *
 * Pure, every input a parameter, nothing reads a database - the contract
 * `domain/pricing` and `domain/stock/board.ts` both keep, and for the same
 * reason: these numbers decide money.
 */

import { divRoundHalfUp } from '@/domain/money/money';
import type { Grosze } from '@/domain/money/money';

/** One purchased batch, as much of it as this calculation needs. */
export type ConsumableBatch = {
  readonly id: string;
  /** Boards bought in this batch. */
  readonly quantity: number;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Cumulative area already drawn from this batch, in mm². */
  readonly consumedAreaMm2: number;
  /** Net, for one board of these dimensions. */
  readonly purchasePriceGrosze: Grosze;
  /** The FIFO key. */
  readonly purchasedAt: Date;
};

/** One batch's share of a single consumption. */
export type BatchDraw = {
  readonly batchId: string;
  readonly areaMm2: number;
  readonly costGrosze: Grosze;
};

export type ConsumptionPlan = {
  readonly draws: readonly BatchDraw[];
  /** Area the recorded stock could not cover. Zero when it could. */
  readonly shortfallAreaMm2: number;
  readonly totalCostGrosze: Grosze;
};

/**
 * How much of this batch is still uncut.
 *
 * Floored at zero, which is reachable without a bug: `/panel/magazyn`'s +/-
 * control adjusts the board count of a batch that may already have been
 * drawn from, so an operator correcting a miscount downwards can leave less
 * board than has been consumed. A negative remainder would then be added to
 * the next batch's capacity and quietly invent material.
 */
export function remainingAreaMm2(batch: ConsumableBatch): number {
  const held = batch.quantity * batch.widthMm * batch.heightMm;
  return Math.max(0, held - batch.consumedAreaMm2);
}

/**
 * Draw `neededAreaMm2` from these batches, oldest first.
 *
 * Reports a shortfall rather than throwing when the recorded stock cannot
 * cover the need. Production happens whether or not the bookkeeping is up to
 * date, and refusing to move a real order into production because a delivery
 * was never entered would be the tail wagging the dog. The caller surfaces
 * the shortfall; nothing here pretends the material was there.
 */
export function planConsumption(
  batches: readonly ConsumableBatch[],
  neededAreaMm2: number,
): ConsumptionPlan {
  const draws: BatchDraw[] = [];
  let outstanding = Math.max(0, Math.trunc(neededAreaMm2));

  // Sorted here rather than trusted from the caller. FIFO is the decision,
  // and a decision that lives only in a repository's ORDER BY is one a later
  // query rewrite can drop without failing a single test.
  const oldestFirst = [...batches].sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());

  for (const batch of oldestFirst) {
    if (outstanding === 0) {
      break;
    }
    const available = remainingAreaMm2(batch);
    if (available === 0) {
      continue;
    }

    const areaMm2 = Math.min(available, outstanding);
    draws.push({
      batchId: batch.id,
      areaMm2,
      // The draw's share of one board's price. Not `boardCostPerM2Grosze`
      // multiplied out: that rounds to the metre first and would then round
      // again here, and two roundings on a figure this small is how a cost
      // report stops reconciling with the stock movement beside it.
      costGrosze: divRoundHalfUp(areaMm2 * batch.purchasePriceGrosze, batch.widthMm * batch.heightMm),
    });
    outstanding -= areaMm2;
  }

  return {
    draws,
    shortfallAreaMm2: outstanding,
    // Summed from the draws rather than computed independently, so a cost
    // report and the stock movements behind it cannot disagree.
    totalCostGrosze: draws.reduce((total, draw) => total + draw.costGrosze, 0),
  };
}

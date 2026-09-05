/**
 * `docs/AI-CHECKLIST.md` WAREHOUSE-01 - what an order takes off the shelf.
 *
 * Two owner decisions on 2026-09-05, and both are pinned here because both
 * were genuinely open and either could be "tidied" back later by someone who
 * did not know they were chosen:
 *
 * 1. **Which batch.** Oldest first. Offered cheapest-first and
 *    operator-picks; FIFO won because it is how a physical stack is actually
 *    worked through, so the recorded cost is what was really on the shelf.
 * 2. **How much.** By area, not by whole boards. A 2000x1250 board yields
 *    240 coasters at 100x100, so decrementing a whole board per order item
 *    would be wrong by a factor of 240 within days - which is exactly the
 *    "wrong numbers are worse than no report" risk this item was deferred
 *    over.
 *
 * The known inaccuracy of the area rule, stated because it is a real one:
 * it treats every offcut as usable, so the shelf reads slightly fuller than
 * it is. That was the trade the owner accepted against typing a board count
 * on every order, and it errs optimistic by a few percent rather than
 * pessimistic by 24000%.
 */

import { describe, expect, it } from 'vitest';

import { planConsumption, remainingAreaMm2 } from '@/domain/stock/consumption';
import type { ConsumableBatch } from '@/domain/stock/consumption';

/** A real board size from `warehouse.spec.ts`: 2000 x 1250, 320 zl net. */
function batch(overrides: Partial<ConsumableBatch> = {}): ConsumableBatch {
  return {
    id: 'batch-1',
    quantity: 1,
    widthMm: 2_000,
    heightMm: 1_250,
    consumedAreaMm2: 0,
    purchasePriceGrosze: 32_000,
    purchasedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const BOARD_AREA_MM2 = 2_000 * 1_250;

describe('remainingAreaMm2', () => {
  it('is the whole batch when nothing has been consumed', () => {
    expect(remainingAreaMm2(batch({ quantity: 3 }))).toBe(3 * BOARD_AREA_MM2);
  });

  it('subtracts what has already been taken', () => {
    expect(remainingAreaMm2(batch({ consumedAreaMm2: 500_000 }))).toBe(BOARD_AREA_MM2 - 500_000);
  });

  it('never reports a negative remainder', () => {
    // Reachable without a bug: the +/- control on /panel/magazyn adjusts the
    // board count of a batch that has already been drawn from, so an
    // operator correcting a miscount downwards can legitimately leave less
    // board than has been consumed. A negative here would then be added to
    // the next batch's capacity and quietly invent material.
    expect(remainingAreaMm2(batch({ quantity: 1, consumedAreaMm2: BOARD_AREA_MM2 * 2 }))).toBe(0);
  });
});

describe('planConsumption - oldest batch first', () => {
  const older = batch({ id: 'older', purchasedAt: new Date('2026-01-01T00:00:00Z') });
  const newer = batch({ id: 'newer', purchasedAt: new Date('2026-06-01T00:00:00Z') });

  it('draws from the oldest batch while it can cover the whole need', () => {
    const plan = planConsumption([newer, older], 100_000);

    expect(plan.draws).toEqual([{ batchId: 'older', areaMm2: 100_000, costGrosze: 1_280 }]);
    expect(plan.shortfallAreaMm2).toBe(0);
  });

  it('sorts by purchase date rather than trusting the caller order', () => {
    // The repository query orders by `purchasedAt`, but FIFO is the owner's
    // decision and belongs somewhere a test can drive it - not in an ORDER
    // BY that a later query rewrite could drop without failing anything.
    const plan = planConsumption([newer, older], 100_000);
    expect(plan.draws[0]?.batchId).toBe('older');
  });

  it('spills into the next batch only once the older one is empty', () => {
    const nearlyEmpty = batch({
      id: 'older',
      consumedAreaMm2: BOARD_AREA_MM2 - 40_000,
      purchasedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const plan = planConsumption([newer, nearlyEmpty], 100_000);

    expect(plan.draws).toEqual([
      { batchId: 'older', areaMm2: 40_000, costGrosze: 512 },
      { batchId: 'newer', areaMm2: 60_000, costGrosze: 768 },
    ]);
    expect(plan.totalCostGrosze).toBe(1_280);
  });

  it('skips a batch with nothing left rather than emitting a zero draw', () => {
    const empty = batch({ id: 'older', consumedAreaMm2: BOARD_AREA_MM2, purchasedAt: new Date('2026-01-01T00:00:00Z') });
    const plan = planConsumption([empty, newer], 10_000);

    expect(plan.draws).toEqual([{ batchId: 'newer', areaMm2: 10_000, costGrosze: 128 }]);
  });
});

describe('planConsumption - cost', () => {
  it('charges a draw its share of the board price, not the whole board', () => {
    // Half a board of a 320 zl board is 160 zl. The whole point of the area
    // rule: a cost report that billed 320 zl here would be the error this
    // decision exists to avoid.
    const plan = planConsumption([batch()], BOARD_AREA_MM2 / 2);
    expect(plan.totalCostGrosze).toBe(16_000);
  });

  it('rounds a partial share half-up, the same way every other price in the project does', () => {
    // 1 mm2 of a 32000 grosz, 2500000 mm2 board is 0.0128 gr - which must
    // round to 0 rather than to a phantom grosz on every item.
    expect(planConsumption([batch()], 1).totalCostGrosze).toBe(0);
  });

  it('totals what the draws say, so a cost report and a stock movement cannot disagree', () => {
    const plan = planConsumption([batch({ quantity: 4 })], 1_000_000);
    const summed = plan.draws.reduce((total, draw) => total + draw.costGrosze, 0);
    expect(plan.totalCostGrosze).toBe(summed);
  });
});

describe('planConsumption - not enough on the shelf', () => {
  it('reports the shortfall instead of inventing material', () => {
    const plan = planConsumption([batch({ quantity: 1 })], BOARD_AREA_MM2 + 300_000);

    expect(plan.draws).toEqual([{ batchId: 'batch-1', areaMm2: BOARD_AREA_MM2, costGrosze: 32_000 }]);
    expect(plan.shortfallAreaMm2).toBe(300_000);
  });

  it('reports the whole need as a shortfall when there is no stock at all', () => {
    // The ordinary case for a shop that has not recorded a delivery yet, and
    // the reason a shortfall is reported rather than thrown: production
    // happens whether or not the bookkeeping is up to date, and blocking a
    // real order on a missing warehouse row would be the tail wagging the dog.
    const plan = planConsumption([], 50_000);

    expect(plan.draws).toEqual([]);
    expect(plan.shortfallAreaMm2).toBe(50_000);
    expect(plan.totalCostGrosze).toBe(0);
  });

  it('needs nothing for an item with no area', () => {
    const plan = planConsumption([batch()], 0);
    expect(plan.draws).toEqual([]);
    expect(plan.shortfallAreaMm2).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { summariseTopEntities } from '@/domain/analytics/top-entities';
import type { TopEntityRow } from '@/domain/analytics/top-entities';

/**
 * The admin dashboard's "best selling" panels.
 *
 * **Found by measuring, 2026-09-16.** The dashboard's five parallel queries
 * cost 116 ms in total and `getTopEntities` was 107 ms of it - because it
 * reads **every `OrderItem` in the range** and aggregates in JavaScript, and
 * the page calls it three times (product, design, material). Three identical
 * full reads of the same rows, differing only in which key of the snapshot
 * each one looks at.
 *
 * The obvious remedy was to stream the slow panel behind `<Suspense>`. That
 * would have hidden the cost rather than removed it, and left the database
 * doing three times the work it needs to. Reading the rows once and bucketing
 * them per kind is both faster and less code.
 *
 * Extracted as a pure function so "one read, many kinds" is **structurally**
 * true rather than a comment asking future callers to be careful: the
 * repository can only pass rows it has already fetched.
 */

const row = (
  quantity: number,
  lineGrossGrosze: number,
  snapshot: Partial<TopEntityRow['snapshot']>,
): TopEntityRow => ({
  quantity,
  lineGrossGrosze,
  snapshot: { productNamePl: 'Produkt', materialNamePl: 'Dąb', ...snapshot } as TopEntityRow['snapshot'],
});

describe('summariseTopEntities', () => {
  it('buckets one set of rows into every kind at once', () => {
    const rows = [
      row(1, 10_000, { productNamePl: 'Obraz', materialNamePl: 'Dąb', designNamePl: 'Las' }),
      row(2, 5_000, { productNamePl: 'Stołek', materialNamePl: 'Dąb', designNamePl: 'Góry' }),
    ];

    const result = summariseTopEntities(rows, ['product', 'material', 'design'], 5);

    // Each kind sees the same two rows through a different field.
    expect(result.product.map((entity) => entity.name)).toEqual(['Obraz', 'Stołek']);
    expect(result.design.map((entity) => entity.name)).toEqual(['Las', 'Góry']);
    // Both rows share a material, so it aggregates into one entry.
    expect(result.material).toEqual([{ name: 'Dąb', revenueGrosze: 15_000, quantity: 3 }]);
  });

  it('ranks by revenue, not by quantity', () => {
    /*
      A cheap item can outsell an expensive one many times over and still be
      worth less. "Top" on a revenue dashboard means money.
    */
    const rows = [
      row(50, 5_000, { productNamePl: 'Brelok' }),
      row(1, 40_000, { productNamePl: 'Blat' }),
    ];

    const result = summariseTopEntities(rows, ['product'], 5);

    expect(result.product.map((entity) => entity.name)).toEqual(['Blat', 'Brelok']);
  });

  it('applies the limit after ranking, not before', () => {
    const rows = [
      row(1, 100, { productNamePl: 'A' }),
      row(1, 900, { productNamePl: 'B' }),
      row(1, 500, { productNamePl: 'C' }),
    ];

    const result = summariseTopEntities(rows, ['product'], 2);

    expect(result.product.map((entity) => entity.name)).toEqual(['B', 'C']);
  });

  it('falls back to the design code when a design has no name', () => {
    // Custom uploads have a code and no catalogue name. Dropping them would
    // silently understate how much of the business is bespoke work.
    const rows = [row(1, 1_000, { designNamePl: null, designCode: 'WZ-114' })];

    const result = summariseTopEntities(rows, ['design'], 5);

    expect(result.design).toEqual([{ name: 'WZ-114', revenueGrosze: 1_000, quantity: 1 }]);
  });

  it('skips a row whose kind is absent rather than inventing a name', () => {
    /*
      A line with no material - a pure service line, say - must not become an
      entry called "null" or "". It is simply not a material sale.
    */
    const rows = [
      row(1, 1_000, { materialNamePl: null as unknown as string }),
      row(1, 2_000, { materialNamePl: 'Sosna' }),
    ];

    const result = summariseTopEntities(rows, ['material'], 5);

    expect(result.material).toEqual([{ name: 'Sosna', revenueGrosze: 2_000, quantity: 1 }]);
  });

  it('returns an empty list per kind for no rows, not a missing key', () => {
    // The dashboard indexes into this by kind; a missing key would be a
    // runtime error on a shop that has not sold anything yet.
    const result = summariseTopEntities([], ['product', 'design', 'material'], 5);

    expect(result).toEqual({ product: [], design: [], material: [] });
  });
});

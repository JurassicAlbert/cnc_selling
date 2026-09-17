import type { OrderItemSnapshot } from '@/server/orders/snapshot';

/**
 * Ranking the best-selling products, designs and materials from order lines.
 *
 * **Pure, and separated from the repository on purpose.** The admin
 * dashboard's five parallel queries cost 116 ms, and `getTopEntities` was
 * 107 ms of that: it reads every `OrderItem` in the range and aggregates in
 * JavaScript, and the page called it three times, once per kind. Three
 * identical reads of the same rows, differing only in which snapshot key each
 * one looked at.
 *
 * Reading the rows once and bucketing them per kind removes two thirds of the
 * database work rather than hiding it behind a `<Suspense>` boundary. Doing
 * the arithmetic here rather than in the repository makes that structural: a
 * caller can only pass rows it has already fetched, so the three-reads shape
 * cannot come back by accident.
 *
 * **Why this is JavaScript rather than SQL at all**: the names live inside
 * `OrderItem.snapshot`, the immutable JSON an order keeps so that rendering
 * it never joins to a live catalogue row (`schema.prisma`). Grouping by a key
 * inside that document is not something Prisma's `groupBy` reaches.
 */

export type TopEntityKind = 'product' | 'design' | 'material';

export type TopEntity = {
  readonly name: string;
  readonly revenueGrosze: number;
  readonly quantity: number;
};

/** One order line, reduced to what ranking needs. */
export type TopEntityRow = {
  readonly quantity: number;
  readonly lineGrossGrosze: number;
  readonly snapshot: OrderItemSnapshot;
};

function entityName(kind: TopEntityKind, snapshot: OrderItemSnapshot): string | null {
  if (kind === 'product') {
    return snapshot.productNamePl ?? null;
  }
  if (kind === 'design') {
    // Custom uploads carry a code and no catalogue name. Dropping them would
    // understate how much of the business is bespoke work.
    return snapshot.designNamePl ?? snapshot.designCode ?? null;
  }
  return snapshot.materialNamePl ?? null;
}

export function summariseTopEntities(
  rows: readonly TopEntityRow[],
  kinds: readonly TopEntityKind[],
  limit: number,
): Record<TopEntityKind, readonly TopEntity[]> {
  const buckets = new Map<TopEntityKind, Map<string, { revenueGrosze: number; quantity: number }>>();
  for (const kind of kinds) {
    buckets.set(kind, new Map());
  }

  // One pass over the rows for every kind at once - the whole point.
  for (const row of rows) {
    for (const kind of kinds) {
      const name = entityName(kind, row.snapshot);
      // A line with no material is not a material sale. It must not become an
      // entry called "null".
      if (name === null || name === '') {
        continue;
      }
      const byName = buckets.get(kind);
      if (byName === undefined) {
        continue;
      }
      const bucket = byName.get(name) ?? { revenueGrosze: 0, quantity: 0 };
      bucket.revenueGrosze += row.lineGrossGrosze;
      bucket.quantity += row.quantity;
      byName.set(name, bucket);
    }
  }

  const result = {} as Record<TopEntityKind, readonly TopEntity[]>;
  for (const kind of kinds) {
    result[kind] = Array.from(buckets.get(kind) ?? new Map(), ([name, bucket]) => ({ name, ...bucket }))
      // Revenue, not quantity: a cheap item can outsell an expensive one many
      // times over and still be worth less.
      .sort((a, b) => b.revenueGrosze - a.revenueGrosze)
      // After ranking, never before.
      .slice(0, limit);
  }
  return result;
}

/**
 * Turning a query string into a `skip`/`take` that is safe to hand Prisma -
 * `docs/AI-CHECKLIST.md` ADMIN-01.
 *
 * The admin lists used to take the newest N rows and stop: 100 orders, 100
 * customers, 200 audit entries, with no cursor, no total and nothing on
 * screen saying a subset was being shown. The dev database holds 166 orders,
 * so 66 of them were unreachable, and the audit log - which §16A.2 keeps as a
 * compliance record - silently forgot everything older than its 200th entry.
 *
 * Pure and shared, for the same reason `domain/cart/quantity.ts` is: every
 * value here arrives in a URL, which makes it attacker-controlled, and
 * `take: 1e9` or `skip: -1` reaches the database exactly as readily as `2`
 * does. One clamp, tested once, used by every list.
 */

/** What the grid offers, and the most a single request will serialise. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * How far into a list a request is allowed to skip.
 *
 * `?page=999999999` is free to type and expensive to answer: an offset is
 * counted row by row, so a huge `skip` makes Postgres walk the whole index
 * before returning nothing. The cap is far past any list this admin panel
 * will ever hold and still bounded.
 */
const MAX_SKIP = MAX_PAGE_SIZE * 10_000;

export type PageRequest = {
  /** 0-based, as the grid and Prisma want it. */
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly skip: number;
  readonly take: number;
};

/**
 * A positive integer, or `null` for anything else.
 *
 * `Number()` is deliberately not used: it accepts `'1e3'`, `' 2 '` and `''`
 * (as zero), none of which is a page number somebody typed. A URL that
 * carries nonsense should show the first page, never an error - a malformed
 * parameter in a shared or truncated link is a normal thing to receive.
 */
function positiveInteger(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePagination(params: {
  readonly page?: string;
  readonly perPage?: string;
}): PageRequest {
  const requestedSize = positiveInteger(params.perPage);
  const pageSize = requestedSize === null ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);

  // 1-based in the URL because that is what a person reading it expects;
  // 0-based everywhere else because that is what the grid and Prisma want.
  const requestedPage = positiveInteger(params.page);
  const pageIndex = requestedPage === null ? 0 : requestedPage - 1;

  const skip = Math.min(pageIndex * pageSize, MAX_SKIP);

  return { pageIndex, pageSize, skip, take: pageSize };
}

export type PageDescription = {
  /** 1-based and inclusive, for display. Both zero when the page holds nothing. */
  readonly from: number;
  readonly to: number;
  readonly total: number;
};

/**
 * „Pokazano 1-25 z 166" - the line ADMIN-01 asked for as a stopgap and which
 * stays as the permanent answer. A list showing a subset has to say so,
 * whatever the reason.
 *
 * An empty page reads as empty rather than as "1-0 of 0", and a page past
 * the end of the data - reachable by hand-editing the URL, or by rows being
 * deleted while somebody sits on the last page - claims no rows at all
 * rather than a range that does not exist.
 */
export function describePage(page: {
  readonly skip: number;
  readonly take: number;
  readonly total: number;
}): PageDescription {
  if (page.total === 0 || page.skip >= page.total) {
    return { from: 0, to: 0, total: page.total };
  }
  return {
    from: page.skip + 1,
    to: Math.min(page.skip + page.take, page.total),
    total: page.total,
  };
}

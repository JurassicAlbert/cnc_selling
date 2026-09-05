/**
 * `docs/AI-CHECKLIST.md` BUG-23 - order numbers were built from server-local
 * time.
 *
 * `2026/09/0001` is a customer-facing reference and an accounting one: it is
 * printed on the confirmation, quoted in support requests, and the month in
 * it is the month the shop will reconcile the order against. It was produced
 * with `now.getFullYear()` / `now.getMonth()`, which read whatever timezone
 * the server process happens to be in.
 *
 * On this machine that is Europe/Warsaw and everything looked correct. On a
 * UTC host - which is every serverless platform this could deploy to,
 * including the Vercel target §18 names - an order placed at 00:30 on 1
 * September in Warsaw is 22:30 on 31 August UTC, so it would be numbered
 * `2026/08/…` and counted into the wrong month. The same `now` also feeds
 * `OrderNumberCounter.yearMonth`, so the sequence would jump back into the
 * previous month's series and start colliding with numbers already issued.
 *
 * Nothing here needs a database, which is the point of splitting it out of
 * `create-order.ts`: the rule is about a calendar, and a calendar is
 * testable without one.
 */

import { describe, expect, it } from 'vitest';

import { orderNumberYearMonth, formatOrderNumber } from '@/domain/orders/order-number';

describe('orderNumberYearMonth', () => {
  it('uses Warsaw time, not the server\'s', () => {
    // 22:30 UTC on 31 August is 00:30 on 1 September in Warsaw (CEST, UTC+2).
    // The order belongs to September, whatever the host clock says.
    expect(orderNumberYearMonth(new Date('2026-08-31T22:30:00Z'))).toEqual({ year: 2026, month: 9 });
  });

  it('keeps an order in August when Warsaw is still in August', () => {
    // 21:30 UTC the same evening is 23:30 on the 31st in Warsaw.
    expect(orderNumberYearMonth(new Date('2026-08-31T21:30:00Z'))).toEqual({ year: 2026, month: 8 });
  });

  it('rolls the year over on Warsaw\'s new year, not UTC\'s', () => {
    // 23:30 UTC on 31 December is 00:30 on 1 January in Warsaw (CET, UTC+1).
    expect(orderNumberYearMonth(new Date('2026-12-31T23:30:00Z'))).toEqual({ year: 2027, month: 1 });
  });

  it('handles winter time, where the offset is one hour rather than two', () => {
    // 23:30 UTC on 31 January is 00:30 on 1 February in Warsaw (CET, UTC+1).
    expect(orderNumberYearMonth(new Date('2026-01-31T23:30:00Z'))).toEqual({ year: 2026, month: 2 });
    // But 22:30 UTC is still 23:30 on the 31st - the summer example above
    // would have crossed here, which is exactly why the offset cannot be
    // hard-coded.
    expect(orderNumberYearMonth(new Date('2026-01-31T22:30:00Z'))).toEqual({ year: 2026, month: 1 });
  });

  it('is unambiguous across the autumn clock change, when 02:30 Warsaw happens twice', () => {
    // Both readings of 02:30 on 25 October 2026 fall in the same month, so
    // the answer is the same either way. Pinned because a naive fix that
    // parsed a formatted local string could throw or double-count here.
    expect(orderNumberYearMonth(new Date('2026-10-25T00:30:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(orderNumberYearMonth(new Date('2026-10-25T01:30:00Z'))).toEqual({ year: 2026, month: 10 });
  });
});

describe('formatOrderNumber', () => {
  it('is zero-padded to the shape customers already have on their invoices', () => {
    expect(formatOrderNumber({ year: 2026, month: 9 }, 42)).toBe('2026/09/0042');
  });

  it('pads the month too', () => {
    expect(formatOrderNumber({ year: 2026, month: 1 }, 1)).toBe('2026/01/0001');
  });

  it('does not truncate a sequence past four digits', () => {
    // A shop that issues more than 9999 orders in a month should get a longer
    // number, not a wrapped one - two orders sharing a number is worse than
    // an ugly one.
    expect(formatOrderNumber({ year: 2026, month: 9 }, 12_345)).toBe('2026/09/12345');
  });
});

/**
 * `docs/AI-CHECKLIST.md` ADMIN-01 - the admin lists truncate silently.
 *
 * `listOrdersForAdmin` took the newest 100 rows and stopped. The dev database
 * holds 166 orders, so 66 of them were simply unreachable, with nothing on
 * screen saying so; the audit log - the §16A.2 compliance record - forgot
 * everything past 200 entries the same way.
 *
 * This is the pure half: turning whatever arrives in the query string into a
 * `skip`/`take` that is safe to hand Prisma. It is worth testing on its own
 * because the inputs are entirely attacker-controlled - a page number is a
 * URL parameter, and `take: 1e9` or `skip: -1` reaches the database as
 * readily as `2` does.
 */

import { describe, expect, it } from 'vitest';

import { MAX_PAGE_SIZE, parsePagination } from '@/domain/pagination/page';

describe('parsePagination', () => {
  it('defaults to the first page when nothing is given', () => {
    const page = parsePagination({});

    expect(page.pageIndex).toBe(0);
    expect(page.skip).toBe(0);
    expect(page.take).toBe(page.pageSize);
  });

  it('turns a page number into a skip', () => {
    // The URL is 1-based because that is what a person reading it expects;
    // `pageIndex` is 0-based because that is what the grid and Prisma want.
    const page = parsePagination({ page: '3', perPage: '25' });

    expect(page.pageIndex).toBe(2);
    expect(page.skip).toBe(50);
    expect(page.take).toBe(25);
  });

  it.each([
    ['zero', '0'],
    ['negative', '-4'],
    ['fractional', '2.7'],
    ['not a number', 'abc'],
    ['empty', ''],
    ['scientific notation', '1e3'],
  ])('falls back to the first page for a %s page number', (_label, value) => {
    // Never an error page. A malformed page number in a shared or truncated
    // link should show the list, not a stack trace.
    expect(parsePagination({ page: value }).pageIndex).toBe(0);
  });

  it('refuses a page size larger than the maximum', () => {
    // The one that matters: `perPage` is the parameter that decides how much
    // of the table a single request serialises into the RSC payload.
    const page = parsePagination({ perPage: '100000' });

    expect(page.take).toBe(MAX_PAGE_SIZE);
  });

  it.each(['0', '-10', 'abc', '2.5'])('falls back to the default page size for %s', (value) => {
    expect(parsePagination({ perPage: value }).take).toBe(parsePagination({}).take);
  });

  it('accepts the page sizes the grid actually offers', () => {
    for (const size of [25, 50, 100]) {
      expect(parsePagination({ perPage: String(size) }).take).toBe(size);
    }
  });

  it('caps how far into a list a request can skip', () => {
    // Without this, `?page=1000000000` multiplies out to a skip Postgres has
    // to count past row by row. The cap is far beyond any real list and
    // still bounded.
    const page = parsePagination({ page: '999999999', perPage: '100' });

    expect(Number.isSafeInteger(page.skip)).toBe(true);
    expect(page.skip).toBeLessThanOrEqual(MAX_PAGE_SIZE * 10_000);
  });
});

describe('describePage', () => {
  it('says what is shown out of what exists', async () => {
    const { describePage } = await import('@/domain/pagination/page');

    // The stopgap ADMIN-01 asked for, kept as the permanent answer: a list
    // that shows a subset must say so on screen, whatever the reason.
    expect(describePage({ skip: 0, take: 25, total: 166 })).toEqual({ from: 1, to: 25, total: 166 });
    expect(describePage({ skip: 150, take: 25, total: 166 })).toEqual({ from: 151, to: 166, total: 166 });
  });

  it('reads as empty rather than as "1-0 of 0"', async () => {
    const { describePage } = await import('@/domain/pagination/page');

    expect(describePage({ skip: 0, take: 25, total: 0 })).toEqual({ from: 0, to: 0, total: 0 });
  });

  it('does not claim rows past the end when a page is beyond the data', async () => {
    const { describePage } = await import('@/domain/pagination/page');

    // Reachable by hand-editing the URL, or by deleting rows while someone
    // is on the last page.
    expect(describePage({ skip: 500, take: 25, total: 166 })).toEqual({ from: 0, to: 0, total: 166 });
  });
});

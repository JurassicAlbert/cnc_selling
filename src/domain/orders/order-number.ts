/**
 * The calendar an order number is filed under - `docs/AI-CHECKLIST.md` BUG-23.
 *
 * `2026/09/0042` is both a customer-facing reference and an accounting one:
 * printed on the confirmation, quoted in support requests, and the month in
 * it is the month the shop reconciles the order against.
 *
 * It used to be built from `now.getFullYear()` / `now.getMonth()`, which read
 * whatever timezone the server process happened to be in. On a developer's
 * machine that is Europe/Warsaw and everything looked right. On a UTC host -
 * every serverless platform this could deploy to, the Vercel target §18 names
 * included - an order placed at 00:30 on 1 September in Warsaw is 22:30 on 31
 * August UTC, so it would be numbered `2026/08/…`. The same value keys
 * `OrderNumberCounter.yearMonth`, so the sequence would also jump back into
 * the previous month's series and start colliding with numbers already issued.
 *
 * The shop is Polish, sells in złoty and invoices under Polish law, so the
 * calendar is Warsaw's regardless of where the code runs. Not a fixed offset:
 * Poland is UTC+1 in winter and UTC+2 in summer, and a hard-coded offset would
 * be wrong for half the year - which is precisely the class of bug this is.
 *
 * Pure, no database, no `now` of its own. The caller passes the instant.
 */

const TIMEZONE = 'Europe/Warsaw';

export type OrderYearMonth = {
  readonly year: number;
  readonly month: number;
};

/**
 * `Intl` rather than arithmetic on an offset, because it is the only thing in
 * the platform that actually knows when Poland changes its clocks, and it
 * keeps knowing when the rules change.
 *
 * `en-CA` gives ISO-ordered `YYYY-MM-DD`, which is the least ambiguous locale
 * output to split on. The parts are read by name rather than by position, so
 * a locale or runtime that ordered them differently would not silently swap
 * the year and the day.
 */
const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function orderNumberYearMonth(at: Date): OrderYearMonth {
  const parts = PARTS.formatToParts(at);
  const value = (type: 'year' | 'month'): number => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) {
      throw new Error(`orderNumberYearMonth: Intl gave no ${type} for ${at.toISOString()}`);
    }
    return Number.parseInt(part.value, 10);
  };

  return { year: value('year'), month: value('month') };
}

/** The counter's key. One sequence per Warsaw month, which is what BUG-23 is about. */
export function orderNumberCounterKey(yearMonth: OrderYearMonth): string {
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`;
}

/**
 * `2026/09/0042` - the shape customers already have on their invoices.
 *
 * `padStart` rather than a fixed slice: a shop issuing more than 9999 orders
 * in one month should get a longer number, not a wrapped one. Two orders
 * sharing a number is a far worse outcome than an ugly number, and the column
 * is `@unique`, so the wrapped one would fail the insert rather than quietly
 * duplicate - a refused checkout for a customer who did nothing wrong.
 */
export function formatOrderNumber(yearMonth: OrderYearMonth, sequence: number): string {
  const month = String(yearMonth.month).padStart(2, '0');
  return `${yearMonth.year}/${month}/${String(sequence).padStart(4, '0')}`;
}

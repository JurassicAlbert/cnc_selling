/**
 * Money in this codebase is ALWAYS an integer number of grosze (1 zł = 100 gr).
 *
 * There is no float anywhere in the pricing path. Every operation that could
 * produce a fraction goes through `divRoundHalfUp`, which does the rounding on
 * integers so the result is exact and reproducible. This is the single measure
 * that prevents the classic "total is 1 grosz off the invoice" class of bug.
 *
 * Factors are expressed in basis points (10000 = x1.00) so that a 1.15
 * multiplier is the integer 11500 and never the float 1.15.
 */

/** An integer number of grosze. Nominal type for documentation purposes. */
export type Grosze = number;

/** Basis points denominator. 10000 bp = x1.00 */
export const BASIS_POINTS = 10_000;

/** Grosze in one złoty. */
export const GROSZE_PER_ZLOTY = 100;

/** Standard Polish VAT rate, in basis points. */
export const VAT_STANDARD_BP = 2_300;

export class MoneyError extends Error {
  override name = 'MoneyError';
}

export function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `${label} must be a safe integer (grosze), received ${String(value)}`,
    );
  }
}

export function assertNonNegative(value: number, label: string): void {
  assertInteger(value, label);
  if (value < 0) {
    throw new MoneyError(`${label} must not be negative, received ${value}`);
  }
}

/**
 * Integer division rounding halves AWAY FROM ZERO (i.e. half-up for the
 * non-negative amounts we actually deal with).
 *
 * Implemented with integer remainder arithmetic rather than `Math.round(a / b)`
 * so that the .5 boundary is decided exactly instead of by floating point.
 */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  assertInteger(numerator, 'numerator');
  assertInteger(denominator, 'denominator');
  if (denominator === 0) {
    throw new MoneyError('denominator must not be zero');
  }

  const negative = numerator < 0 !== denominator < 0;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);

  // Math.floor(n / d) can be off by one at the extremes of the safe-integer
  // range, so correct the quotient using the exact remainder.
  let q = Math.floor(n / d);
  let r = n - q * d;
  if (r < 0) {
    q -= 1;
    r += d;
  } else if (r >= d) {
    q += 1;
    r -= d;
  }

  const rounded = r * 2 >= d ? q + 1 : q;
  return negative ? -rounded : rounded;
}

/** Multiply an amount by a basis-point factor. 10000 bp leaves it unchanged. */
export function applyFactorBp(amount: Grosze, factorBp: number): Grosze {
  assertInteger(amount, 'amount');
  assertNonNegative(factorBp, 'factorBp');
  return divRoundHalfUp(amount * factorBp, BASIS_POINTS);
}

/** Apply a sequence of basis-point factors, rounding once at the end. */
export function applyFactorsBp(
  amount: Grosze,
  factorsBp: readonly number[],
): Grosze {
  assertInteger(amount, 'amount');
  let numerator = amount;
  let denominator = 1;
  for (const factor of factorsBp) {
    assertNonNegative(factor, 'factorBp');
    numerator *= factor;
    denominator *= BASIS_POINTS;
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
      throw new MoneyError(
        'factor chain overflowed the safe integer range; reduce the number of chained factors',
      );
    }
  }
  return divRoundHalfUp(numerator, denominator);
}

/** VAT amount for a net price. */
export function vatFor(netGrosze: Grosze, vatRateBp: number): Grosze {
  assertNonNegative(netGrosze, 'netGrosze');
  assertNonNegative(vatRateBp, 'vatRateBp');
  return divRoundHalfUp(netGrosze * vatRateBp, BASIS_POINTS);
}

/** Gross price for a net price. */
export function grossFor(netGrosze: Grosze, vatRateBp: number): Grosze {
  return netGrosze + vatFor(netGrosze, vatRateBp);
}

export function sumGrosze(values: readonly Grosze[]): Grosze {
  let total = 0;
  for (const value of values) {
    assertInteger(value, 'value');
    total += value;
  }
  assertInteger(total, 'sum');
  return total;
}

/**
 * Format for display: `1 234,56 zł`.
 *
 * Two things about the output that look like bugs and are not:
 *
 *  - The space before `zł` is U+00A0, so a price never wraps away from its
 *    currency symbol.
 *  - Four-digit amounts are NOT grouped: `1234,56 zł`, not `1 234,56 zł`.
 *    Polish CLDR sets minimumGroupingDigits to 2, so the separator appears
 *    only from five digits. If the brand prefers grouping everywhere, add
 *    `useGrouping: 'always'` here - but change it in one place, not per call
 *    site, and update the tests deliberately.
 */
export function formatPln(grosze: Grosze): string {
  assertInteger(grosze, 'grosze');
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / GROSZE_PER_ZLOTY);
}

/** Format without the currency symbol, e.g. for input fields: `1 234,56`. */
export function formatAmountPl(grosze: Grosze): string {
  assertInteger(grosze, 'grosze');
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(grosze / GROSZE_PER_ZLOTY);
}

/** Convert złoty (as a decimal number) to grosze. Use only at data-entry edges. */
export function zlotyToGrosze(zloty: number): Grosze {
  if (!Number.isFinite(zloty)) {
    throw new MoneyError(`zloty must be finite, received ${String(zloty)}`);
  }
  // `12.345 * 100` is not exactly 1234.5 in binary floating point, so the
  // product is cleaned to a fixed number of decimals before rounding.
  // Without this, half-way values round in whichever direction the
  // representation error happens to fall.
  const scaled = Number((zloty * GROSZE_PER_ZLOTY).toFixed(6));
  return Math.round(scaled);
}

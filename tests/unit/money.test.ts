import { describe, expect, it } from 'vitest';

import {
  BASIS_POINTS,
  MoneyError,
  VAT_STANDARD_BP,
  applyFactorBp,
  applyFactorsBp,
  divRoundHalfUp,
  formatAmountPl,
  formatPln,
  grossFor,
  sumGrosze,
  vatFor,
  zlotyToGrosze,
} from '@/domain/money/money';

/** Intl uses non-breaking / narrow-no-break spaces. Normalise before asserting. */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f\u2009]/g, ' ');
}

describe('divRoundHalfUp', () => {
  it('divides exactly when there is no remainder', () => {
    expect(divRoundHalfUp(1000, 10)).toBe(100);
  });

  it('rounds down below the half', () => {
    expect(divRoundHalfUp(14, 10)).toBe(1);
  });

  it('rounds UP exactly at the half - this is the boundary that decides invoices', () => {
    expect(divRoundHalfUp(15, 10)).toBe(2);
    expect(divRoundHalfUp(5, 10)).toBe(1);
    expect(divRoundHalfUp(25, 10)).toBe(3);
  });

  it('rounds up above the half', () => {
    expect(divRoundHalfUp(16, 10)).toBe(2);
  });

  it('rounds halves away from zero for negative numerators', () => {
    expect(divRoundHalfUp(-15, 10)).toBe(-2);
    expect(divRoundHalfUp(-14, 10)).toBe(-1);
  });

  it('handles a negative denominator', () => {
    expect(divRoundHalfUp(15, -10)).toBe(-2);
  });

  it('stays exact for large values where float division drifts', () => {
    expect(divRoundHalfUp(9_007_199_254_740_990, 2)).toBe(4_503_599_627_370_495);
  });

  it('rejects a zero denominator', () => {
    expect(() => divRoundHalfUp(1, 0)).toThrow(MoneyError);
  });

  it('rejects non-integer input, because money is never fractional here', () => {
    expect(() => divRoundHalfUp(1.5, 10)).toThrow(MoneyError);
  });
});

describe('applyFactorBp', () => {
  it('leaves the amount unchanged at 10000 bp', () => {
    expect(applyFactorBp(12_345, BASIS_POINTS)).toBe(12_345);
  });

  it('applies a premium', () => {
    // 100,00 zł x 1.15 = 115,00 zł
    expect(applyFactorBp(10_000, 11_500)).toBe(11_500);
  });

  it('applies a discount factor', () => {
    expect(applyFactorBp(10_000, 9_000)).toBe(9_000);
  });

  it('rounds half-up on the resulting grosz', () => {
    // 1 gr x 1.5 = 1.5 gr -> 2 gr
    expect(applyFactorBp(1, 15_000)).toBe(2);
  });

  it('returns zero for a zero factor', () => {
    expect(applyFactorBp(12_345, 0)).toBe(0);
  });

  it('rejects a negative factor', () => {
    expect(() => applyFactorBp(100, -1)).toThrow(MoneyError);
  });
});

describe('applyFactorsBp', () => {
  it('rounds ONCE at the end rather than after each factor', () => {
    // Rounding after each step would give 1 -> 2 -> 3.
    // Rounding once gives 1 x 1.5 x 1.5 = 2.25 -> 2.
    expect(applyFactorsBp(1, [15_000, 15_000])).toBe(2);
  });

  it('is the identity for an empty factor list', () => {
    expect(applyFactorsBp(9_999, [])).toBe(9_999);
  });

  it('throws rather than silently losing precision on overflow', () => {
    const many = new Array<number>(6).fill(11_000);
    expect(() => applyFactorsBp(99_999_999, many)).toThrow(MoneyError);
  });
});

describe('VAT', () => {
  it('computes 23% VAT on a round net amount', () => {
    // 100,00 zł net -> 23,00 zł VAT
    expect(vatFor(10_000, VAT_STANDARD_BP)).toBe(2_300);
  });

  it('computes gross from net', () => {
    expect(grossFor(10_000, VAT_STANDARD_BP)).toBe(12_300);
  });

  it('rounds VAT half-up on an awkward net amount', () => {
    // 8,99 zł net x 0.23 = 2,0677 zł -> 2,07 zł
    expect(vatFor(899, VAT_STANDARD_BP)).toBe(207);
    expect(grossFor(899, VAT_STANDARD_BP)).toBe(1_106);
  });

  it('handles a zero net amount', () => {
    expect(vatFor(0, VAT_STANDARD_BP)).toBe(0);
  });

  it('rejects a negative net amount', () => {
    expect(() => vatFor(-1, VAT_STANDARD_BP)).toThrow(MoneyError);
  });
});

describe('sumGrosze', () => {
  it('sums a list', () => {
    expect(sumGrosze([100, 250, 3])).toBe(353);
  });

  it('returns zero for an empty list', () => {
    expect(sumGrosze([])).toBe(0);
  });

  it('rejects a fractional member', () => {
    expect(() => sumGrosze([100, 0.5])).toThrow(MoneyError);
  });
});

describe('formatting', () => {
  it('formats złoty with a comma decimal and the symbol after the number', () => {
    expect(normalizeSpaces(formatPln(123_456))).toBe('1234,56 zł');
  });

  it('does NOT group four-digit amounts - Polish CLDR sets minimumGroupingDigits to 2', () => {
    // This surprises people who expect "1 234,56 zł". It is correct for pl-PL:
    // the thousands separator only appears from five digits.
    expect(normalizeSpaces(formatPln(99_999))).toBe('999,99 zł');
    expect(normalizeSpaces(formatPln(123_456))).toBe('1234,56 zł');
  });

  it('groups from five digits upwards', () => {
    expect(normalizeSpaces(formatPln(1_234_567))).toBe('12 345,67 zł');
    expect(normalizeSpaces(formatPln(12_345_678))).toBe('123 456,78 zł');
  });

  it('always shows two decimal places', () => {
    expect(normalizeSpaces(formatPln(10_000))).toBe('100,00 zł');
    expect(normalizeSpaces(formatPln(5))).toBe('0,05 zł');
  });

  it('formats zero', () => {
    expect(normalizeSpaces(formatPln(0))).toBe('0,00 zł');
  });

  it('formats a bare amount without the currency symbol', () => {
    expect(normalizeSpaces(formatAmountPl(123_456))).toBe('1234,56');
    expect(normalizeSpaces(formatAmountPl(12_345_678))).toBe('123 456,78');
  });

  it('separates the amount from zł with a non-breaking space so a price never wraps', () => {
    expect(formatPln(123_456)).toContain('\u00a0z\u0142');
  });
});

describe('zlotyToGrosze', () => {
  it('converts a whole złoty amount', () => {
    expect(zlotyToGrosze(12)).toBe(1_200);
  });

  it('converts a two-decimal amount', () => {
    expect(zlotyToGrosze(12.34)).toBe(1_234);
  });

  it('rounds half-up beyond two decimals', () => {
    expect(zlotyToGrosze(12.345)).toBe(1_235);
  });

  it('rejects a non-finite value', () => {
    expect(() => zlotyToGrosze(Number.NaN)).toThrow(MoneyError);
  });
});

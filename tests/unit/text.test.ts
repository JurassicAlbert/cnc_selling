import { describe, expect, it } from 'vitest';

import { comparePl, foldPl, matchesPl, sortByPl } from '@/domain/text/collation';
import {
  formatDimensionsPl,
  formatMmAsCentimetres,
  parseCentimetresToMm,
  parseDecimalPl,
} from '@/domain/text/numeric-input';

function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f\u2009]/g, ' ');
}

describe('parseDecimalPl', () => {
  it('accepts a comma decimal, which is how Polish users type', () => {
    const result = parseDecimalPl('1,2');
    expect(result).toEqual({ ok: true, value: 1.2 });
  });

  it('accepts a period decimal too, because keyboards vary', () => {
    expect(parseDecimalPl('1.2')).toEqual({ ok: true, value: 1.2 });
  });

  it('accepts an integer', () => {
    expect(parseDecimalPl('120')).toEqual({ ok: true, value: 120 });
  });

  it('tolerates grouping spaces', () => {
    expect(parseDecimalPl('1 234,5')).toEqual({ ok: true, value: 1234.5 });
  });

  it('tolerates a non-breaking space, which is what Intl emits', () => {
    expect(parseDecimalPl(`1\u00a0234,5`)).toEqual({ ok: true, value: 1234.5 });
  });

  it('rejects two separators rather than guessing which is decimal', () => {
    expect(parseDecimalPl('1,2,3')).toEqual({
      ok: false,
      code: 'MULTIPLE_SEPARATORS',
    });
    expect(parseDecimalPl('1.234,5')).toEqual({
      ok: false,
      code: 'MULTIPLE_SEPARATORS',
    });
  });

  it('rejects an empty string', () => {
    expect(parseDecimalPl('')).toEqual({ ok: false, code: 'EMPTY' });
    expect(parseDecimalPl('   ')).toEqual({ ok: false, code: 'EMPTY' });
  });

  it('rejects text', () => {
    expect(parseDecimalPl('abc')).toEqual({ ok: false, code: 'NOT_A_NUMBER' });
    expect(parseDecimalPl('12cm')).toEqual({ ok: false, code: 'NOT_A_NUMBER' });
  });

  it('does NOT silently truncate like parseFloat does', () => {
    // The bug this module exists to prevent.
    expect(Number.parseFloat('1,2')).toBe(1);
    expect(parseDecimalPl('1,2')).toEqual({ ok: true, value: 1.2 });
  });

  it('accepts a leading sign', () => {
    expect(parseDecimalPl('-5')).toEqual({ ok: true, value: -5 });
  });
});

describe('parseCentimetresToMm', () => {
  it('converts whole centimetres to millimetres', () => {
    expect(parseCentimetresToMm('120')).toEqual({
      ok: true,
      mm: 1200,
      rounded: false,
    });
  });

  it('converts a comma decimal', () => {
    expect(parseCentimetresToMm('62,5')).toEqual({
      ok: true,
      mm: 625,
      rounded: false,
    });
  });

  it('rounds sub-millimetre precision and reports that it did', () => {
    const result = parseCentimetresToMm('12,55');
    expect(result).toEqual({ ok: true, mm: 126, rounded: true });
  });

  it('rejects a negative dimension', () => {
    expect(parseCentimetresToMm('-5')).toEqual({
      ok: false,
      code: 'OUT_OF_RANGE',
    });
  });

  it('accepts zero, leaving range checks to the dimension validator', () => {
    expect(parseCentimetresToMm('0')).toEqual({
      ok: true,
      mm: 0,
      rounded: false,
    });
  });

  it('propagates parse errors unchanged', () => {
    expect(parseCentimetresToMm('abc')).toEqual({
      ok: false,
      code: 'NOT_A_NUMBER',
    });
  });
});

describe('dimension formatting', () => {
  it('formats millimetres as centimetres', () => {
    expect(formatMmAsCentimetres(1200)).toBe('120');
    expect(formatMmAsCentimetres(625)).toBe('62,5');
  });

  it('formats a pair of dimensions the way the catalogue shows them', () => {
    expect(normalizeSpaces(formatDimensionsPl(1200, 900))).toBe('120 × 90 cm');
  });
});

describe('comparePl', () => {
  it('sorts Polish letters in their proper places, not after z', () => {
    const sorted = sortByPl(['Zebra', 'Łoś', 'Ćma', 'Aleja'], (v) => v);
    expect(sorted).toEqual(['Aleja', 'Ćma', 'Łoś', 'Zebra']);
  });

  it('places ą immediately after a', () => {
    expect(comparePl('ą', 'b')).toBeLessThan(0);
    expect(comparePl('ą', 'a')).toBeGreaterThan(0);
  });

  it('sorts material names as a customer would expect', () => {
    const sorted = sortByPl(['Sklejka', 'Jesion', 'Dąb', 'Buk'], (v) => v);
    expect(sorted).toEqual(['Buk', 'Dąb', 'Jesion', 'Sklejka']);
  });

  it('does not mutate the input array', () => {
    const input = ['Zebra', 'Aleja'];
    sortByPl(input, (v) => v);
    expect(input).toEqual(['Zebra', 'Aleja']);
  });
});

describe('foldPl and search matching', () => {
  it('folds every Polish diacritic', () => {
    expect(foldPl('ąćęłńóśźż')).toBe('acelnoszz');
    expect(foldPl('ĄĆĘŁŃÓŚŹŻ')).toBe('acelnoszz');
  });

  it('handles ł, which NFD normalisation does not decompose', () => {
    expect(foldPl('Łoś')).toBe('los');
  });

  it('finds "dąb" when the customer types "dab"', () => {
    expect(matchesPl('Dąb', 'dab')).toBe(true);
  });

  it('finds "dab" when the customer types "dąb"', () => {
    expect(matchesPl('Dab europejski', 'dąb')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesPl('Sklejka brzozowa', 'BRZOZ')).toBe(true);
  });

  it('returns false for a genuine miss', () => {
    expect(matchesPl('Dąb', 'buk')).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(matchesPl('Dąb', '')).toBe(true);
    expect(matchesPl('Dąb', '   ')).toBe(true);
  });
});

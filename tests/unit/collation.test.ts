import { describe, expect, it } from 'vitest';

import { comparePl, foldPl, matchesPl, sortByPl } from '@/domain/text/collation';

describe('comparePl / sortByPl', () => {
  it('sorts Polish diacritics in alphabetical order, not code-point order', () => {
    // Plain JS `.sort()` (code-point order) would put every accented
    // letter after 'z': ['Zebra', 'Łoś', 'Ćma'] - this must not.
    const names = ['Zebra', 'Ćma', 'Łoś'];
    expect([...names].sort(comparePl)).toEqual(['Ćma', 'Łoś', 'Zebra']);
  });

  it('sorts a real catalogue-style name list correctly', () => {
    const names = ['Żywica', 'Dąb', 'Aluminium', 'Łupek'];
    expect([...names].sort(comparePl)).toEqual(['Aluminium', 'Dąb', 'Łupek', 'Żywica']);
  });

  it('sortByPl sorts objects by a derived Polish-text key, returning a new array', () => {
    const items = [{ namePl: 'Żywica' }, { namePl: 'Dąb' }, { namePl: 'Aluminium' }];
    const sorted = sortByPl(items, (i) => i.namePl);
    expect(sorted.map((i) => i.namePl)).toEqual(['Aluminium', 'Dąb', 'Żywica']);
    // Original array untouched.
    expect(items.map((i) => i.namePl)).toEqual(['Żywica', 'Dąb', 'Aluminium']);
  });
});

describe('foldPl / matchesPl', () => {
  it('foldPl strips diacritics and lowercases, ł handled explicitly', () => {
    expect(foldPl('Dąb')).toBe('dab');
    expect(foldPl('Łoś')).toBe('los');
    expect(foldPl('ŻÓŁW')).toBe('zolw');
  });

  it('matchesPl finds a diacritic-free query inside diacritic-bearing text', () => {
    expect(matchesPl('Dąb', 'dab')).toBe(true);
    expect(matchesPl('Stołek loftowy', 'stolek')).toBe(true);
  });

  it('matchesPl is case-insensitive too', () => {
    expect(matchesPl('Dąb', 'DAB')).toBe(true);
  });

  it('matchesPl returns true for an empty/whitespace query - "no filter" reads as a match', () => {
    expect(matchesPl('Dąb', '')).toBe(true);
    expect(matchesPl('Dąb', '   ')).toBe(true);
  });

  it('matchesPl returns false for genuinely absent text', () => {
    expect(matchesPl('Dąb', 'gres')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { NOUNS } from '@/domain/text/nouns';
import { countPl, pluralPl } from '@/domain/text/plural';

function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f\u2009]/g, ' ');
}

describe('pluralPl — the three Polish forms', () => {
  const modul = NOUNS.module;

  it('uses the singular for 1', () => {
    expect(pluralPl(1, modul)).toBe('moduł');
  });

  it('uses the "few" form for 2, 3 and 4', () => {
    expect(pluralPl(2, modul)).toBe('moduły');
    expect(pluralPl(3, modul)).toBe('moduły');
    expect(pluralPl(4, modul)).toBe('moduły');
  });

  it('uses the "many" form from 5 upwards', () => {
    expect(pluralPl(5, modul)).toBe('modułów');
    expect(pluralPl(11, modul)).toBe('modułów');
    expect(pluralPl(21, modul)).toBe('modułów');
  });

  it('returns to the "few" form at 22, 23, 24 — the case English intuition misses', () => {
    expect(pluralPl(22, modul)).toBe('moduły');
    expect(pluralPl(23, modul)).toBe('moduły');
    expect(pluralPl(24, modul)).toBe('moduły');
  });

  it('uses "many" at 25 and for the teens ending in 2..4', () => {
    expect(pluralPl(25, modul)).toBe('modułów');
    // 112 % 10 === 2 but 112 % 100 === 12, so it is NOT the "few" form.
    expect(pluralPl(112, modul)).toBe('modułów');
    expect(pluralPl(13, modul)).toBe('modułów');
  });

  it('uses the "few" form at 102, where the hundreds do not interfere', () => {
    expect(pluralPl(102, modul)).toBe('moduły');
  });

  it('uses the "many" form for zero', () => {
    expect(pluralPl(0, modul)).toBe('modułów');
  });

  it('uses the genitive singular for decimal counts', () => {
    expect(pluralPl(1.5, NOUNS.day)).toBe('dnia');
    expect(pluralPl(2.5, NOUNS.day)).toBe('dnia');
  });

  it('falls back to the "many" form when no decimal form is supplied', () => {
    expect(pluralPl(1.5, NOUNS.module)).toBe('modułów');
  });

  it('rejects a non-finite count rather than rendering nonsense', () => {
    expect(() => pluralPl(Number.NaN, modul)).toThrow(TypeError);
  });
});

describe('countPl', () => {
  it('renders the number with its correct form', () => {
    expect(normalizeSpaces(countPl(1, NOUNS.module))).toBe('1 moduł');
    expect(normalizeSpaces(countPl(4, NOUNS.module))).toBe('4 moduły');
    expect(normalizeSpaces(countPl(9, NOUNS.module))).toBe('9 modułów');
  });

  it('joins with a non-breaking space so the count never wraps away from the noun', () => {
    expect(countPl(4, NOUNS.module)).toContain('\u00a0');
  });

  it('formats larger numbers with Polish grouping (which starts at five digits)', () => {
    // 1234 % 10 === 4 and 1234 % 100 === 34, so this takes the FEW form.
    // Reaching for "produktów" here is the mistake English intuition makes.
    expect(normalizeSpaces(countPl(1234, NOUNS.product))).toBe('1234 produkty');
    expect(normalizeSpaces(countPl(12345, NOUNS.product))).toBe('12 345 produktów');
  });
});

describe('the noun table itself', () => {
  it('covers every noun with all three required forms', () => {
    for (const [key, forms] of Object.entries(NOUNS)) {
      expect(forms.one, `${key}.one`).toBeTruthy();
      expect(forms.few, `${key}.few`).toBeTruthy();
      expect(forms.many, `${key}.many`).toBeTruthy();
    }
  });
});

import { describe, expect, it } from 'vitest';

import type {
  FontSpec,
  PersonalizationSpec,
} from '@/domain/personalization/validate';
import {
  POLISH_SPECIFIC_LETTERS,
  codePointsOf,
  supportsPolishDiacritics,
  unsupportedCharacters,
  validatePersonalization,
} from '@/domain/personalization/validate';

const LATIN_BASIC =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-–&\'"!?()';

/** A well-made face with full Polish coverage. */
const FULL_FONT: FontSpec = {
  id: 'inter',
  minHeightMm: 4,
  supportedCodePoints: codePointsOf(LATIN_BASIC + POLISH_SPECIFIC_LETTERS),
};

/** The realistic hazard: a decorative script with Basic Latin only. */
const DECORATIVE_FONT: FontSpec = {
  id: 'script-decorative',
  minHeightMm: 8,
  supportedCodePoints: codePointsOf(LATIN_BASIC),
};

const SPEC: PersonalizationSpec = {
  maxCharacters: 40,
  maxLines: 2,
  minTextHeightMm: 6,
};

function codes(
  text: string,
  textHeightMm = 12,
  font: FontSpec = FULL_FONT,
  spec: PersonalizationSpec = SPEC,
): string[] {
  return validatePersonalization({ text, textHeightMm }, spec, font).map(
    (issue) => issue.code,
  );
}

describe('validatePersonalization — valid text', () => {
  it('accepts plain text', () => {
    expect(codes('Anna i Piotr')).toEqual([]);
  });

  it('accepts Polish diacritics in a font that covers them', () => {
    expect(codes('Michał Zażółć')).toEqual([]);
  });

  it('accepts text at exactly the character limit', () => {
    expect(codes('A'.repeat(40))).toEqual([]);
  });

  it('accepts text at exactly the line limit', () => {
    expect(codes('Anna\nPiotr')).toEqual([]);
  });

  it('accepts text at exactly the minimum height', () => {
    expect(codes('Anna', 6)).toEqual([]);
  });

  it('accepts a date and coordinates', () => {
    expect(codes('23.08.2026')).toEqual([]);
    expect(codes('52.2297 N, 21.0122 E')).toEqual([]);
  });
});

describe('validatePersonalization — the engraving font trap', () => {
  it('rejects ł when the chosen decorative face does not contain it', () => {
    // The whole reason this module exists. "Michał" on a script face without
    // ł would otherwise be engraved as "Micha" or a fallback glyph.
    const issues = validatePersonalization(
      { text: 'Michał', textHeightMm: 12 },
      SPEC,
      DECORATIVE_FONT,
    );
    expect(issues).toEqual([{ code: 'UNSUPPORTED_CHARACTER', character: 'ł' }]);
  });

  it('accepts the same name in a font that covers Polish', () => {
    expect(codes('Michał', 12, FULL_FONT)).toEqual([]);
  });

  it('names every missing character so alternatives can be suggested', () => {
    // Za-ż-ó-ł-ć g-ę-ś-l-ą: seven distinct Polish letters this face lacks.
    expect(unsupportedCharacters('Zażółć gęślą', DECORATIVE_FONT).sort()).toEqual(
      ['ą', 'ć', 'ę', 'ł', 'ó', 'ś', 'ż'].sort(),
    );
  });

  it('returns nothing missing for a complete font', () => {
    expect(unsupportedCharacters('Zażółć gęślą jaźń', FULL_FONT)).toEqual([]);
  });

  it('detects Polish coverage on a font record', () => {
    expect(supportsPolishDiacritics(FULL_FONT)).toBe(true);
    expect(supportsPolishDiacritics(DECORATIVE_FONT)).toBe(false);
  });
});

describe('validatePersonalization — length and structure', () => {
  it('rejects text one character over the limit', () => {
    expect(codes('A'.repeat(41))).toEqual(['TEXT_TOO_LONG']);
  });

  it('counts code points, not UTF-16 units', () => {
    const issues = validatePersonalization(
      { text: 'AB', textHeightMm: 12 },
      { ...SPEC, maxCharacters: 2 },
      FULL_FONT,
    );
    expect(issues).toEqual([]);
  });

  it('does not count newlines against the character limit', () => {
    expect(codes(`${'A'.repeat(20)}\n${'B'.repeat(20)}`)).toEqual([]);
  });

  it('rejects too many lines', () => {
    expect(codes('A\nB\nC')).toContain('TOO_MANY_LINES');
  });

  it('rejects empty text', () => {
    expect(codes('')).toEqual(['TEXT_EMPTY']);
  });

  it('rejects whitespace-only text', () => {
    expect(codes('   ')).toEqual(['TEXT_EMPTY']);
    expect(codes('\n\n')).toEqual(['TEXT_EMPTY']);
  });

  it('reports only TEXT_EMPTY for empty input, not a pile of consequences', () => {
    expect(codes('', 1)).toHaveLength(1);
  });
});

describe('validatePersonalization — emoji', () => {
  it('rejects an emoji, which no engraving font can carve', () => {
    expect(codes('Anna 😀')).toContain('EMOJI_NOT_SUPPORTED');
  });

  it('reports emoji distinctly from a missing letter', () => {
    const issues = validatePersonalization(
      { text: '😀', textHeightMm: 12 },
      SPEC,
      FULL_FONT,
    );
    expect(issues).toEqual([{ code: 'EMOJI_NOT_SUPPORTED', character: '😀' }]);
  });
});

describe('validatePersonalization — text height', () => {
  it('rejects text below the font legibility floor', () => {
    expect(codes('Anna', 5, DECORATIVE_FONT)).toContain('TEXT_TOO_SMALL_FOR_FONT');
  });

  it('rejects text below what the material can hold', () => {
    expect(codes('Anna', 5, FULL_FONT)).toContain('TEXT_TOO_SMALL_FOR_MATERIAL');
  });

  it('reports both limits when both are violated', () => {
    const result = codes('Anna', 2, DECORATIVE_FONT);
    expect(result).toContain('TEXT_TOO_SMALL_FOR_FONT');
    expect(result).toContain('TEXT_TOO_SMALL_FOR_MATERIAL');
  });

  it('accepts text that clears the higher of the two limits', () => {
    expect(codes('Anna', 8, DECORATIVE_FONT)).toEqual([]);
  });

  it('reports the actual and the limit so the message can be specific', () => {
    const issues = validatePersonalization(
      { text: 'Anna', textHeightMm: 3 },
      SPEC,
      FULL_FONT,
    );
    expect(issues).toContainEqual({
      code: 'TEXT_TOO_SMALL_FOR_MATERIAL',
      actual: 3,
      limit: 6,
    });
  });
});

describe('codePointsOf', () => {
  it('builds a coverage set from a glyph string', () => {
    const set = codePointsOf('ał');
    expect(set.has('a'.codePointAt(0) ?? -1)).toBe(true);
    expect(set.has('ł'.codePointAt(0) ?? -1)).toBe(true);
    expect(set.has('b'.codePointAt(0) ?? -1)).toBe(false);
  });
});

/**
 * Personalization validation.
 *
 * The stake here is unusual: engraved text cannot be corrected. If a
 * decorative face has no `ł` and the customer's name is Michał, the preview
 * silently substitutes a fallback glyph and the mistake becomes permanent on a
 * finished oak tabletop. So the font's ACTUAL glyph coverage is checked, not
 * assumed, and an uncovered character is a hard error rather than a warning.
 */

export type PersonalizationSpec = {
  readonly maxCharacters: number;
  readonly maxLines: number;
  /** Smallest text this material can hold, from the material record. */
  readonly minTextHeightMm: number;
};

export type FontSpec = {
  readonly id: string;
  /** Below this height this particular face stops being legible. */
  readonly minHeightMm: number;
  /**
   * Code points the font file actually contains, parsed from its cmap table
   * at seed time. Not a guess, not a locale assumption.
   */
  readonly supportedCodePoints: ReadonlySet<number>;
};

export type PersonalizationInput = {
  readonly text: string;
  /** Cap height the text will be engraved at, from the layout. */
  readonly textHeightMm: number;
};

export type PersonalizationIssueCode =
  | 'TEXT_EMPTY'
  | 'TEXT_TOO_LONG'
  | 'TOO_MANY_LINES'
  | 'EMOJI_NOT_SUPPORTED'
  | 'UNSUPPORTED_CHARACTER'
  | 'TEXT_TOO_SMALL_FOR_FONT'
  | 'TEXT_TOO_SMALL_FOR_MATERIAL';

export type PersonalizationIssue = {
  readonly code: PersonalizationIssueCode;
  /** The offending character, when the issue is about one. */
  readonly character?: string;
  readonly actual?: number;
  readonly limit?: number;
};

/** The nine Polish letters that decorative fonts most often omit. */
export const POLISH_SPECIFIC_LETTERS = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

export function validatePersonalization(
  input: PersonalizationInput,
  spec: PersonalizationSpec,
  font: FontSpec,
): PersonalizationIssue[] {
  const issues: PersonalizationIssue[] = [];
  const { text } = input;

  if (text.trim().length === 0) {
    return [{ code: 'TEXT_EMPTY' }];
  }

  const lines = text.split('\n');
  const characters = personalizationCharacters(text);

  if (characters.length > spec.maxCharacters) {
    issues.push({
      code: 'TEXT_TOO_LONG',
      actual: characters.length,
      limit: spec.maxCharacters,
    });
  }

  if (lines.length > spec.maxLines) {
    issues.push({
      code: 'TOO_MANY_LINES',
      actual: lines.length,
      limit: spec.maxLines,
    });
  }

  for (const character of characters) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (isEmoji(codePoint)) {
      issues.push({ code: 'EMOJI_NOT_SUPPORTED', character });
      break;
    }
    if (!font.supportedCodePoints.has(codePoint)) {
      issues.push({ code: 'UNSUPPORTED_CHARACTER', character });
      break;
    }
  }

  if (input.textHeightMm < font.minHeightMm) {
    issues.push({
      code: 'TEXT_TOO_SMALL_FOR_FONT',
      actual: input.textHeightMm,
      limit: font.minHeightMm,
    });
  }

  if (input.textHeightMm < spec.minTextHeightMm) {
    issues.push({
      code: 'TEXT_TOO_SMALL_FOR_MATERIAL',
      actual: input.textHeightMm,
      limit: spec.minTextHeightMm,
    });
  }

  return issues;
}

/**
 * The characters of a personalization text, as the code points that will
 * actually be engraved.
 *
 * Newlines are layout, not glyphs, so they are not characters. Code points
 * rather than UTF-16 units, because a single emoji has length 2 and the count
 * would otherwise depend on how the input was normalised.
 *
 * Exported because the same count decides two different things - whether the
 * text fits, and what it costs. Two implementations of that rule would
 * eventually disagree, and the customer would be charged for a character the
 * validator did not count.
 */
export function personalizationCharacters(text: string): string[] {
  return [...text.replace(/\n/g, '')];
}

/** How many characters a personalization text is billed and validated for. */
export function countPersonalizationCharacters(text: string): number {
  return personalizationCharacters(text).length;
}

/**
 * Characters in the text that the font cannot render.
 * Used to tell the customer which faces would work instead.
 */
export function unsupportedCharacters(text: string, font: FontSpec): string[] {
  const missing = new Set<string>();
  for (const character of text.replace(/\n/g, '')) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && !font.supportedCodePoints.has(codePoint)) {
      missing.add(character);
    }
  }
  return [...missing];
}

/** True when a font covers every Polish-specific letter. */
export function supportsPolishDiacritics(font: FontSpec): boolean {
  for (const letter of POLISH_SPECIFIC_LETTERS) {
    const codePoint = letter.codePointAt(0);
    if (codePoint === undefined || !font.supportedCodePoints.has(codePoint)) {
      return false;
    }
  }
  return true;
}

/** Build a coverage set from a string of every glyph the font contains. */
export function codePointsOf(characters: string): Set<number> {
  const set = new Set<number>();
  for (const character of characters) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined) {
      set.add(codePoint);
    }
  }
  return set;
}

function isEmoji(codePoint: number): boolean {
  return (
    codePoint >= 0x1f000 ||
    (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
    codePoint === 0xfe0f ||
    codePoint === 0x200d
  );
}

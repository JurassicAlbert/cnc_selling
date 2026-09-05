/**
 * Polish plurals have three forms where English has two.
 *
 *   1 moduł        (one)
 *   2 moduły       (few)   - n % 10 in 2..4, and n % 100 not in 12..14
 *   5 modułów      (many)  - everything else
 *   1,5 dnia       (other) - decimals take the genitive singular
 *
 * `n === 1 ? singular : plural` is simply wrong here, and it is wrong in
 * every place a count is rendered: modules, days, cart items, reviews.
 */

export type PolishPluralForms = {
  /** 1 */
  readonly one: string;
  /** 2, 3, 4, 22, 23, 24, ... */
  readonly few: string;
  /** 0, 5..21, 25..31, ... */
  readonly many: string;
  /**
   * Decimal counts (1,5 / 2,5). Polish uses the genitive singular here, which
   * is often a different word from `many` - "1,5 dnia" but "5 dni".
   * Falls back to `many` when not supplied.
   */
  readonly other?: string;
};

const pluralRules = new Intl.PluralRules('pl-PL');
const numberFormat = new Intl.NumberFormat('pl-PL', {
  maximumFractionDigits: 2,
});

/** Non-breaking space (U+00A0): a count must never wrap away from its noun. */
export const NBSP = '\u00a0';

/** Pick the correct Polish form for a count. Returns the word only. */
export function pluralPl(count: number, forms: PolishPluralForms): string {
  if (!Number.isFinite(count)) {
    throw new TypeError(`count must be finite, received ${String(count)}`);
  }

  switch (pluralRules.select(count)) {
    case 'one':
      return forms.one;
    case 'few':
      return forms.few;
    case 'many':
      return forms.many;
    default:
      return forms.other ?? forms.many;
  }
}

/** Render a count with its correct form: `5 modułów`. */
export function countPl(count: number, forms: PolishPluralForms): string {
  return `${numberFormat.format(count)}${NBSP}${pluralPl(count, forms)}`;
}

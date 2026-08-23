/**
 * Polish collation and diacritic folding.
 *
 * Default JS string comparison sorts by code point, which puts every accented
 * letter after `z`: "Zebra, Ćma, Łoś" instead of "Ćma, Łoś, Zebra".
 */

// Default sensitivity ('variant') is what we want: ą and a are DIFFERENT
// letters that sort adjacently. `sensitivity: 'base'` would make them equal,
// which is right for searching and wrong for sorting.
const collator = new Intl.Collator('pl-PL', { numeric: true });

/** Compare two strings using Polish alphabetical order. */
export function comparePl(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Sort a list by a derived string key, using Polish order. Returns a new array. */
export function sortByPl<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => comparePl(key(a), key(b)));
}

/**
 * Strip Polish diacritics for search normalisation: `dąb` -> `dab`.
 *
 * `ł` is deliberately handled separately: it is not a combining form, so NFD
 * normalisation leaves it untouched and it would survive the strip.
 */
export function foldPl(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();
}

/** Diacritic- and case-insensitive containment test, for client-side filtering. */
export function matchesPl(haystack: string, needle: string): boolean {
  if (needle.trim().length === 0) {
    return true;
  }
  return foldPl(haystack).includes(foldPl(needle.trim()));
}

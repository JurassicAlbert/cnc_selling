import type { PolishPluralForms } from './plural';

/**
 * Countable nouns used in customer-facing copy.
 *
 * These live here rather than in `content/pl` because they are consumed by the
 * plural helper as structured data, not as free copy.
 */
export const NOUNS = {
  module: {
    one: 'moduł',
    few: 'moduły',
    many: 'modułów',
  },
  workingDay: {
    one: 'dzień roboczy',
    few: 'dni robocze',
    many: 'dni roboczych',
    other: 'dnia roboczego',
  },
  day: {
    one: 'dzień',
    few: 'dni',
    many: 'dni',
    other: 'dnia',
  },
  product: {
    one: 'produkt',
    few: 'produkty',
    many: 'produktów',
  },
  item: {
    one: 'pozycja',
    few: 'pozycje',
    many: 'pozycji',
  },
  order: {
    one: 'zamówienie',
    few: 'zamówienia',
    many: 'zamówień',
  },
  review: {
    one: 'opinia',
    few: 'opinie',
    many: 'opinii',
  },
  character: {
    one: 'znak',
    few: 'znaki',
    many: 'znaków',
  },
  file: {
    one: 'plik',
    few: 'pliki',
    many: 'plików',
  },
  design: {
    one: 'wzór',
    few: 'wzory',
    many: 'wzorów',
  },
} as const satisfies Record<string, PolishPluralForms>;

export type NounKey = keyof typeof NOUNS;

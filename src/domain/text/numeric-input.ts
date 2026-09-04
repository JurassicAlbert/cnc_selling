/**
 * Parsing numbers the way Polish customers type them.
 *
 * `parseFloat("1,2")` returns 1. Silently. A customer entering a 1,2 mm line
 * width or a 62,5 cm panel would get 1 mm and 62 cm, and nothing anywhere
 * would report an error - the product would simply be made the wrong size.
 * This module is the single place where that conversion happens.
 */

export type ParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: ParseErrorCode };

export type ParseErrorCode =
  | 'EMPTY'
  | 'NOT_A_NUMBER'
  | 'MULTIPLE_SEPARATORS'
  | 'OUT_OF_RANGE';

/** Space characters Intl and users produce as thousands separators. */
const SPACE_CHARS = /[\s\u00a0\u202f\u2009]/g;

/**
 * Parse a decimal typed by a Polish user.
 * Accepts `1,2` and `1.2`, tolerates grouping spaces (`1 234,5`).
 * Rejects anything with more than one decimal separator.
 */
export function parseDecimalPl(raw: string): ParseResult {
  const trimmed = raw.replace(SPACE_CHARS, '');
  if (trimmed.length === 0) {
    return { ok: false, code: 'EMPTY' };
  }

  const separatorCount = (trimmed.match(/[.,]/g) ?? []).length;
  if (separatorCount > 1) {
    return { ok: false, code: 'MULTIPLE_SEPARATORS' };
  }

  const normalized = trimmed.replace(',', '.');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
    return { ok: false, code: 'NOT_A_NUMBER' };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, code: 'NOT_A_NUMBER' };
  }

  return { ok: true, value };
}

export type DimensionParseResult =
  | { readonly ok: true; readonly mm: number; readonly rounded: boolean }
  | { readonly ok: false; readonly code: ParseErrorCode };

/**
 * Parse a dimension the customer typed in centimetres into integer millimetres.
 *
 * `rounded` is true when the input carried sub-millimetre precision that was
 * discarded, so the UI can echo back the value actually used rather than
 * letting the customer believe 12,55 cm was honoured.
 */
export function parseCentimetresToMm(raw: string): DimensionParseResult {
  const parsed = parseDecimalPl(raw);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.value < 0) {
    return { ok: false, code: 'OUT_OF_RANGE' };
  }

  const exactMm = Number((parsed.value * 10).toFixed(6));
  const mm = Math.round(exactMm);

  if (!Number.isSafeInteger(mm)) {
    return { ok: false, code: 'OUT_OF_RANGE' };
  }

  return { ok: true, mm, rounded: mm !== exactMm };
}

/** Format integer millimetres back to centimetres for display: 1250 -> `125` */
export function formatMmAsCentimetres(mm: number): string {
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 1,
  }).format(mm / 10);
}

/** `1200 x 900 mm` rendered as `120 × 90 cm` */
export function formatDimensionsPl(widthMm: number, heightMm: number): string {
  return `${formatMmAsCentimetres(widthMm)} × ${formatMmAsCentimetres(heightMm)} cm`;
}

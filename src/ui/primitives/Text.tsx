import type { ReactNode } from 'react';

type TextProps = {
  readonly children: ReactNode;
  /** Matches MUI's `text.secondary` - meta, helper text. */
  readonly muted?: boolean;
  /**
   * Opts out of the reading-measure cap, for the cases where a paragraph is
   * genuinely a full-width row rather than prose - a table-like meta line,
   * or a single value that shares its row with something aligned to the far
   * edge. Rare on purpose: prose is the default, and prose wants a measure.
   */
  readonly full?: boolean;
};

/**
 * The body-text equivalent of `Heading` - see its comment for why this
 * exists and why the `font` shorthand is used.
 *
 * 2026-08-30, typography pass: capped at a reading measure. Body copy used
 * to run the full width of `Container` - 1200px, roughly 150 characters per
 * line, against a comfortable target of 60–75. Past about 80 the eye starts
 * losing its place on the return sweep to the next line, which is why long
 * lines feel tiring to read without looking obviously wrong.
 *
 * It is a MAXIMUM, so it only ever narrows a paragraph: nothing moves, and
 * every `Text` already inside a card, grid cell or column is untouched
 * because it was already narrower than the cap.
 *
 * `text-wrap: pretty` asks the browser to avoid leaving a single word alone
 * on the final line. Unlike `balance` it is cheap enough for body copy of
 * any length, and does nothing where unsupported.
 */
export function Text({ children, muted = false, full = false }: TextProps) {
  return (
    <p
      style={{
        font: 'var(--mui-font-body1)',
        color: muted ? 'var(--mui-palette-text-secondary)' : 'var(--mui-palette-text-primary)',
        maxWidth: full ? undefined : 'var(--measure-prose)',
        textWrap: 'pretty',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

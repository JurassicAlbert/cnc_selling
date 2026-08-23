import type { ReactNode } from 'react';

type TextProps = {
  readonly children: ReactNode;
  /** Matches MUI's `text.secondary` — meta, helper text. */
  readonly muted?: boolean;
};

/** The body-text equivalent of `Heading` — see its comment for why this exists. */
export function Text({ children, muted = false }: TextProps) {
  return (
    <p
      style={{
        font: 'var(--mui-font-body1)',
        color: muted ? 'var(--mui-palette-text-secondary)' : 'var(--mui-palette-text-primary)',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

import type { ReactNode } from 'react';

type SectionProps = {
  readonly children: ReactNode;
  /** Uses the paper surface instead of the page background. */
  readonly surface?: 'default' | 'paper';
};

/** Generous section padding — §2.1's "large section padding" requirement. */
export function Section({ children, surface = 'default' }: SectionProps) {
  return (
    <section
      style={{
        paddingBlock: 96,
        backgroundColor:
          surface === 'paper'
            ? 'var(--mui-palette-background-paper)'
            : 'var(--mui-palette-background-default)',
        borderBottom: '1px solid var(--mui-palette-divider)',
      }}
    >
      {children}
    </section>
  );
}

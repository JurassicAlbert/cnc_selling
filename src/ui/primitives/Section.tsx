import type { ReactNode } from 'react';

type SectionProps = {
  readonly children: ReactNode;
  /** Uses the paper surface instead of the page background. */
  readonly surface?: 'default' | 'paper';
  /** Escape hatch for a section-specific class, e.g. `hero-surface`'s gradient wash. */
  readonly className?: string;
};

/** Generous section padding — §2.1's "large section padding" requirement. */
export function Section({ children, surface = 'default', className }: SectionProps) {
  return (
    <section
      className={className}
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

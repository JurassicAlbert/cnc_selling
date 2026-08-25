import type { ReactNode } from 'react';

import { SectionDecoration } from '@/ui/primitives/SectionDecoration';

type SectionProps = {
  readonly children: ReactNode;
  /** Uses the paper surface instead of the page background. */
  readonly surface?: 'default' | 'paper';
  /** Escape hatch for a section-specific class, e.g. `hero-surface`'s gradient wash. */
  readonly className?: string;
  /**
   * Adds a subtle corner accent (`SectionDecoration`) on top of the section's
   * own gradient wash — reserved for a few real accent points (the
   * homepage's Kategorie/Nasze produkty sections, a category page header),
   * not every section on every page, so it stays an accent rather than
   * repeated noise.
   */
  readonly decorative?: 'left' | 'right' | false;
};

/**
 * Generous section padding — §2.1's "large section padding" requirement.
 *
 * Every section also carries a faint gradient tint (added 2026-08-25,
 * round 2 of the background-depth feedback) layered on top of its flat
 * surface color — `default` and `paper` are tuned differently so the two
 * still read as distinct surfaces, they just aren't perfectly flat anymore.
 */
export function Section({ children, surface = 'default', className, decorative = false }: SectionProps) {
  return (
    <section
      className={className}
      style={{
        position: decorative ? 'relative' : undefined,
        overflow: decorative ? 'hidden' : undefined,
        paddingBlock: 96,
        backgroundColor:
          surface === 'paper'
            ? 'var(--mui-palette-background-paper)'
            : 'var(--mui-palette-background-default)',
        backgroundImage:
          surface === 'paper'
            ? 'linear-gradient(180deg, rgba(169, 123, 79, 0.05) 0%, transparent 40%)'
            : 'linear-gradient(180deg, transparent 0%, rgba(169, 123, 79, 0.06) 100%)',
        borderBottom: '1px solid var(--mui-palette-divider)',
      }}
    >
      {decorative && <SectionDecoration side={decorative} />}
      {children}
    </section>
  );
}

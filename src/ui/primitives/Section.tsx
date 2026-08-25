import type { ReactNode } from 'react';

import { SectionDecoration } from '@/ui/primitives/SectionDecoration';
import type { IconPair } from '@/ui/primitives/SectionDecoration';

export type DecorativeSide = {
  readonly side: 'left' | 'right';
  /** Which 2 material-tile icons this cluster uses — required so different sections don't repeat the same icons (2026-08-26). */
  readonly icons: IconPair;
  /** A real photo path for one large accent hex — optional, used sparingly. */
  readonly photo?: string;
};

type SectionProps = {
  readonly children: ReactNode;
  /** Uses the paper surface instead of the page background. */
  readonly surface?: 'default' | 'paper';
  /** Escape hatch for a section-specific class, e.g. `hero-surface`'s gradient wash. */
  readonly className?: string;
  /**
   * Adds a hexagon corner accent (`SectionDecoration`) on top of the
   * section's own gradient wash — reserved for a few real accent points
   * (the hero on both sides, the homepage's Kategorie/Nasze produkty
   * sections, a category page header), not every section on every page.
   * Pass a single `DecorativeSide` for one side, or a tuple of two for
   * both (the hero).
   */
  readonly decorative?: DecorativeSide | readonly [DecorativeSide, DecorativeSide] | false;
};

/**
 * Generous section padding — §2.1's "large section padding" requirement.
 *
 * Every section also carries a faint gradient tint layered on top of its
 * flat surface color — `default` and `paper` are tuned differently so the
 * two still read as distinct surfaces, they just aren't perfectly flat.
 */
export function Section({ children, surface = 'default', className, decorative = false }: SectionProps) {
  const sides = decorative ? (Array.isArray(decorative) ? decorative : [decorative]) : [];

  return (
    <section
      className={className}
      style={{
        position: decorative ? 'relative' : undefined,
        // `zIndex: 0` (not just `position: relative`) is required so this
        // section establishes its OWN stacking context — otherwise the
        // decoration's `z-index: -1` escapes to a much higher ancestor
        // context (effectively the page root) and paints BEHIND this
        // section's own opaque backgroundColor instead of on top of it,
        // making it invisible. A real bug, caught by actually looking in
        // the browser rather than trusting the CSS to "just work."
        zIndex: decorative ? 0 : undefined,
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
      {sides.map((config) => (
        <SectionDecoration key={config.side} side={config.side} icons={config.icons} photo={config.photo} />
      ))}
      {children}
    </section>
  );
}

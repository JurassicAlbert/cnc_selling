'use client';

/*
  Extracted from `Configurator.tsx` on 2026-09-05 for `docs/AI-CHECKLIST.md`
  ARCH-02: that file was 1 632 lines, three times the next largest in the
  repository, with no test of its own except through e2e. Moved verbatim -
  same body, same props, same behaviour - along a seam that already existed.
  The state model stays in `Configurator.tsx`, which is what ARCH-02 asks.
*/

import { SITE } from '@/content/pl/site';
import { formatPln } from '@/domain/money/money';
import type { Selections } from '@/domain/configuration/steps';
import type { ConfiguratorSnapshot } from '@/server/actions/configurator';

export function StickyPriceBar({
  snapshot,
  loading,
  unavailableSelection,
}: {
  readonly snapshot: ConfiguratorSnapshot | null;
  readonly loading: boolean;
  /** UX-21 - see the parent's own comment. Non-null means: show no figure. */
  readonly unavailableSelection: keyof Selections | null;
}) {
  let valueText: string;
  if (loading || snapshot === null) {
    valueText = SITE.configuratorPriceCalculatingPl;
  } else if (unavailableSelection !== null) {
    // Ahead of the `priced` branch on purpose. `snapshot.pricing` is a real,
    // correctly-computed figure - `getConfiguratorSnapshot` prices by map
    // lookup and does not consult availability - which is exactly why it must
    // not be rendered. The summary panel below carries the full explanation.
    valueText = SITE.configuratorPriceWithdrawnPl;
  } else if (snapshot.pricing.status === 'priced') {
    valueText = formatPln(snapshot.pricing.priceBreakdown.unitGrossGrosze);
  } else if (snapshot.pricing.status === 'incomplete') {
    valueText = SITE.configuratorPriceUnavailablePl;
  } else {
    valueText = SITE.configuratorPriceUnavailableGenericPl;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        background: 'var(--mui-palette-background-paper)',
        borderTop: '1px solid var(--mui-palette-divider)',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          marginInline: 'auto',
          paddingInline: 24,
          paddingBlock: 12,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-secondary)' }}>
          {SITE.configuratorPriceLabelPl}
        </span>
        <span style={{ font: 'var(--mui-font-h5)' }}>{valueText}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Renders EVERY option, never just the selectable ones - ARCHITECTURE.md
 * §7.2: an unavailable option is shown disabled with a Polish reason, not
 * hidden, so the customer learns the rule instead of wondering where an
 * option went. Text-only (`ToggleButtonGroup`) - used for THICKNESS,
 * INSTALLATION_VARIANT, and font choice, the remaining accordion-band
 * steps; DESIGN/MATERIAL/FINISH live in the breadcrumb dropdowns instead
 * (`DesignMenuItem`/`TextMenuItem`, above).
 */

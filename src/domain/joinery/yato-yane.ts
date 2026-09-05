/**
 * Yato-yane - a real Japanese grooved-edge spline (loose-tongue) joint.
 * Both panel edges are grooved; a separate hard strip of wood is inserted
 * into the resulting channel, holding the two panels flush and preventing
 * the joined tabletop from warping along the seam.
 *
 * This module exists to prepare a real, tested domain concept for a
 * business feature the owner wants built but NOT yet enabled: a larger
 * loft-table format assembled from multiple machine-cut panels. It is
 * deliberately **not called from anywhere** - no server action, resolver,
 * pricing path, or `evaluateFeasibility` call site references this file.
 * `Product.supportsPanelJoinery` defaults to `false` on every seeded
 * product, so this stays fully inert until both the flag is flipped and a
 * real call site is wired up.
 *
 * No new size-splitting math is needed here: `domain/modules`'
 * `splitIntoModules` already computes the right module grid for a joined
 * size (e.g. 1200x1000mm against 600x500mm machine limits already yields a
 * 2x2 grid) - this module only adds the technique's identity and a
 * dedicated feasibility notice distinct from the generic "your product got
 * split because it was too big" `MODULAR_BUILD` notice.
 */

import type { FeasibilityFinding } from '@/domain/feasibility/rules';

export const JOINERY_TECHNIQUE_YATO_YANE = 'YATO_YANE_SPLINE';

/**
 * A notice-severity finding for a product deliberately assembled from
 * multiple joined panels, distinct from `MODULAR_BUILD` (which fires for
 * ANY reason a product got split, including simply being too big for the
 * machine by surprise). Returns `null` for a single, unjoined panel.
 */
export function buildJoineryFinding(moduleCount: number): FeasibilityFinding | null {
  if (moduleCount <= 1) {
    return null;
  }
  return {
    code: 'JOINED_PANEL_YATO_YANE',
    severity: 'notice',
    requiresAcknowledgement: false,
    params: { moduleCount, technique: JOINERY_TECHNIQUE_YATO_YANE },
  };
}

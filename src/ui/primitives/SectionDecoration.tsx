import type { ComponentType, CSSProperties } from 'react';

import { ChairIcon, DiamondIcon, GridViewIcon, ViewColumnIcon } from '@/ui/icons';

type IconComponent = ComponentType<{ readonly size?: number; readonly style?: CSSProperties }>;

type HexSpec = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Present only on the minority "material tile" hexagons — see this file's header comment. */
  readonly icon?: IconComponent;
};

const CLUSTER_WIDTH = 260;

/** Pointy-top hexagon vertices, center (cx, cy), center-to-vertex radius r. */
function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angleRad = ((-90 + i * 60) * Math.PI) / 180;
    points.push(`${(cx + r * Math.cos(angleRad)).toFixed(1)},${(cy + r * Math.sin(angleRad)).toFixed(1)}`);
  }
  return points.join(' ');
}

/**
 * Cluster is authored in a `CLUSTER_WIDTH`-wide (260) box where HIGH x is
 * the true page edge and LOW x is toward the content — the wrapper below
 * positions this box flush against the section's edge (`[side]: 0`, no
 * negative offset), so everything here is inside the section's own
 * `overflow: hidden` bounds except where a hexagon's own radius pushes
 * past `CLUSTER_WIDTH`, which the SVG's default clip then trims — that's
 * the "partially outside the viewport... feels more organic" bleed, kept
 * to a few outline hexagons only (an icon needs to stay intact to read as
 * a shape, so icon tiles never cross the edge).
 *
 * `CORE_HEXAGONS` is the small subset kept down to 600px (tablet);
 * `EXTRA_HEXAGONS` (below) is hidden under 900px via `.hex-extra` in
 * `theme-vars.css`.
 */
const CORE_HEXAGONS: readonly HexSpec[] = [
  { cx: 200, cy: 70, r: 14 },
  { cx: 225, cy: 190, r: 13 },
  { cx: 195, cy: 310, r: 15 },
  { cx: 230, cy: 430, r: 13 },
  { cx: 200, cy: 550, r: 14 },
];

/**
 * `ChairIcon`/`DiamondIcon`/`GridViewIcon`/`ViewColumnIcon` stand in for
 * furniture, jewellery/materials, tile, and panels — the brief's "small
 * icons representing the products/materials/technology of the brand"
 * without rendering real photos in a decorative accent (would read as a
 * fake curated gallery, and cost real image requests; these reuse the
 * same already-loaded inline icon components used throughout the
 * header/cards).
 */
const EXTRA_HEXAGONS: readonly HexSpec[] = [
  { cx: 245, cy: 40, r: 22 },
  { cx: 220, cy: 120, r: 24, icon: ChairIcon },
  { cx: 170, cy: 150, r: 17 },
  { cx: 240, cy: 230, r: 20 },
  { cx: 215, cy: 345, r: 26, icon: DiamondIcon },
  { cx: 175, cy: 390, r: 15 },
  { cx: 225, cy: 460, r: 22, icon: GridViewIcon },
  { cx: 245, cy: 560, r: 20 },
  { cx: 220, cy: 605, r: 24, icon: ViewColumnIcon },
];

function Hexagon({ cx, cy, r, icon: Icon }: HexSpec) {
  if (Icon) {
    const iconSize = r * 1.15;
    return (
      <>
        <polygon
          points={hexPoints(cx, cy, r)}
          fill="none"
          style={{ stroke: 'var(--mui-palette-secondary-main)', strokeWidth: 1, opacity: 0.22 }}
        />
        <g transform={`translate(${cx - iconSize / 2}, ${cy - iconSize / 2})`}>
          <Icon size={iconSize} style={{ color: 'var(--mui-palette-secondary-main)', opacity: 0.28 }} />
        </g>
      </>
    );
  }
  return (
    <polygon
      points={hexPoints(cx, cy, r)}
      fill="none"
      style={{ stroke: 'var(--mui-palette-secondary-main)', strokeWidth: 1, opacity: 0.15 }}
    />
  );
}

/**
 * A honeycomb accent for a `Section` — the material/product "tile" motif
 * the owner asked for (2026-08-25), replacing the earlier concentric-ring
 * version. Still a pure inline-SVG RSC primitive: `aria-hidden`,
 * `pointer-events: none`, zero client JS, same discipline as
 * `OrbitIconHero` and every other decorative primitive here.
 *
 * The cluster is authored once with its dense side at HIGH local x; for
 * `side="right"` that's flush against the section's right edge as-is, and
 * for `side="left"` the inner `<svg>` is mirrored (`scaleX(-1)`) rather
 * than duplicating hand-placed coordinates — safe for abstract geometric
 * icons like these. The fade mask lives on the OUTER wrapper (before the
 * mirror transform), so its direction is authored correctly per side
 * rather than getting flipped along with the content.
 */
export function SectionDecoration({ side = 'right' }: { readonly side?: 'left' | 'right' }) {
  // side="right": dense edge (high local x) is the box's own right edge,
  // which sits flush at the section's right edge — fade "to left", toward
  // content. side="left": box is flush at the section's left edge and the
  // svg is mirrored, so the dense edge (still authored at high local x,
  // now visually on the left after the flip) lines up with the true page
  // edge — fade "to right", toward content.
  const fadeToward = side === 'right' ? 'left' : 'right';
  const mask = `linear-gradient(to ${fadeToward}, black 0%, black 40%, transparent 85%)`;

  return (
    <div
      aria-hidden="true"
      className="hex-decoration"
      style={{
        position: 'absolute',
        top: '50%',
        [side]: 0,
        transform: 'translateY(-50%)',
        width: CLUSTER_WIDTH,
        height: 640,
        zIndex: -1,
        pointerEvents: 'none',
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${CLUSTER_WIDTH} 640`}
        width="100%"
        height="100%"
        style={{ transform: side === 'left' ? 'scaleX(-1)' : undefined }}
      >
        <g className="hex-core">
          {CORE_HEXAGONS.map((hex) => (
            <Hexagon key={`${hex.cx}-${hex.cy}`} {...hex} />
          ))}
        </g>
        <g className="hex-extra">
          {EXTRA_HEXAGONS.map((hex) => (
            <Hexagon key={`${hex.cx}-${hex.cy}`} {...hex} />
          ))}
        </g>
      </svg>
    </div>
  );
}

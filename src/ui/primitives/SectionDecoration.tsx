import type { ComponentType, CSSProperties } from 'react';
import Image from 'next/image';

import {
  ChairIcon,
  DiamondIcon,
  DrawIcon,
  EngineeringIcon,
  GridViewIcon,
  ImagePlaceholderIcon,
  PrecisionManufacturingIcon,
  ViewColumnIcon,
} from '@/ui/icons';

type IconComponent = ComponentType<{ readonly size?: number; readonly style?: CSSProperties }>;
export type IconPair = readonly [IconComponent, IconComponent];

/**
 * One pair per real placement on the site (2026-08-26 — the owner said the
 * hexagons repeated the same few icons too much). 8 real icons already
 * built for other UI (header, cards, `OrbitIconHero`), each used exactly
 * once across the whole site so no two visible sections repeat an icon.
 */
export const ICON_PAIRS = {
  heroLeft: [ChairIcon, EngineeringIcon] as IconPair,
  heroRight: [DiamondIcon, PrecisionManufacturingIcon] as IconPair,
  kategorie: [GridViewIcon, ImagePlaceholderIcon] as IconPair,
  produkty: [ViewColumnIcon, DrawIcon] as IconPair,
};

type HexSpec = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly icon?: IconComponent;
};

const CLUSTER_WIDTH = 420;

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
 * Authored in a `CLUSTER_WIDTH`-wide box where HIGH x is the true page
 * edge and LOW x is toward the content. Widened and pushed further into
 * the box (2026-08-26 — the owner said the pattern was too narrowed to
 * the margins) — the dense area now spans roughly 270-420 instead of the
 * original 170-260, and the fade mask (in `SectionDecoration` below) was
 * pushed out to match, so the pattern genuinely reaches further into the
 * page rather than hugging the very edge.
 */
const CORE_HEXAGONS: readonly HexSpec[] = [
  { cx: 320, cy: 70, r: 15 },
  { cx: 360, cy: 190, r: 14 },
  { cx: 310, cy: 310, r: 16 },
  { cx: 370, cy: 430, r: 14 },
  { cx: 320, cy: 550, r: 15 },
];

/** Fixed outline hexagons shared by every placement — only the 2 icon slots vary per `IconPair`. */
const EXTRA_OUTLINE: readonly HexSpec[] = [
  { cx: 395, cy: 40, r: 24 },
  { cx: 270, cy: 155, r: 18 },
  { cx: 400, cy: 235, r: 22 },
  { cx: 275, cy: 395, r: 16 },
  { cx: 360, cy: 465, r: 24 },
  { cx: 400, cy: 565, r: 22 },
  { cx: 340, cy: 610, r: 26 },
];

function extraHexagonsFor(icons: IconPair): readonly HexSpec[] {
  return [
    ...EXTRA_OUTLINE,
    { cx: 350, cy: 125, r: 28, icon: icons[0] },
    { cx: 345, cy: 350, r: 30, icon: icons[1] },
  ];
}

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
 * A large photographic hex "tile" — added 2026-08-26 at the owner's
 * request for "some CNC images so the page looks more pro." A real photo
 * (already used elsewhere on the site — no new sourcing), clipped to the
 * same pointy-top hexagon shape as the icon tiles via `clip-path`, muted
 * with opacity + a grayscale filter so it stays a background accent
 * rather than competing with real content photography. Positioned in the
 * same authored coordinate space as the hex data (`left`/`top` here are
 * local-box pixels, high-x/toward-edge convention); its own `<Image>`
 * counter-mirrors (`scaleX(-1)`) when the parent cluster is mirrored for
 * `side="left"`, so the photo itself is never shown flipped.
 */
function HexPhoto({ src, cx, cy, size, mirrored }: { readonly src: string; readonly cx: number; readonly cy: number; readonly size: number; readonly mirrored: boolean }) {
  return (
    <div
      className="hex-extra"
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        overflow: 'hidden',
        opacity: 0.4,
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        style={{
          objectFit: 'cover',
          filter: 'grayscale(35%)',
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
    </div>
  );
}

type SectionDecorationProps = {
  readonly side?: 'left' | 'right';
  readonly icons: IconPair;
  /** A real photo path (e.g. `/images/photos/inne.jpg`) for one large accent hex — optional, used sparingly (1-2 placements sitewide). */
  readonly photo?: string;
};

/**
 * A honeycomb accent for a `Section`. Pure inline-SVG (+ one optional
 * `next/image` for the photo tile) RSC primitive: `aria-hidden`,
 * `pointer-events: none`, zero client JS.
 *
 * The cluster is authored once with its dense side at HIGH local x; for
 * `side="right"` that's flush against the section's right edge as-is, and
 * for `side="left"` the inner wrapper (svg + photo) is mirrored
 * (`scaleX(-1)`) rather than duplicating hand-placed coordinates.
 */
export function SectionDecoration({ side = 'right', icons, photo }: SectionDecorationProps) {
  const fadeToward = side === 'right' ? 'left' : 'right';
  // Pushed further into the page (2026-08-26) — opaque through most of the
  // hex content (which now extends to local x ~270) and a longer, more
  // gradual fade tail, instead of vanishing almost immediately.
  const mask = `linear-gradient(to ${fadeToward}, black 0%, black 38%, transparent 90%)`;
  const mirrored = side === 'left';

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
      <div style={{ position: 'relative', width: '100%', height: '100%', transform: mirrored ? 'scaleX(-1)' : undefined }}>
        <svg aria-hidden="true" viewBox={`0 0 ${CLUSTER_WIDTH} 640`} width="100%" height="100%">
          <g className="hex-core">
            {CORE_HEXAGONS.map((hex) => (
              <Hexagon key={`${hex.cx}-${hex.cy}`} {...hex} />
            ))}
          </g>
          <g className="hex-extra">
            {extraHexagonsFor(icons).map((hex) => (
              <Hexagon key={`${hex.cx}-${hex.cy}`} {...hex} />
            ))}
          </g>
        </svg>
        {photo && <HexPhoto src={photo} cx={330} cy={300} size={160} mirrored={mirrored} />}
      </div>
    </div>
  );
}

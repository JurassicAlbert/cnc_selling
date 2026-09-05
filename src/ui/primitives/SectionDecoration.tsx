import type { ComponentType, CSSProperties } from 'react';

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

export type IconComponent = ComponentType<{ readonly size?: number; readonly style?: CSSProperties }>;
export type IconPair = readonly [IconComponent, IconComponent];
export type EngravingComponent = ComponentType<{ readonly style?: CSSProperties }>;

/**
 * One pair per real placement on the site (2026-08-26 - the owner said the
 * hexagons repeated the same few icons too much). 8 real icons already
 * built for other UI (header, cards, `OrbitIconHero`), each used exactly
 * once across the whole site so no two visible sections repeat an icon.
 * `blog` intentionally reuses `produkty`'s pair - 8 icons across 5
 * placements means one repeat is unavoidable; the two are far enough
 * apart on the page that it doesn't read as repetitive.
 */
export const ICON_PAIRS = {
  heroLeft: [ChairIcon, EngineeringIcon] as IconPair,
  heroRight: [DiamondIcon, PrecisionManufacturingIcon] as IconPair,
  kategorie: [GridViewIcon, ImagePlaceholderIcon] as IconPair,
  produkty: [ViewColumnIcon, DrawIcon] as IconPair,
  blog: [ViewColumnIcon, DrawIcon] as IconPair,
};

export type HexSpec = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly icon?: IconComponent;
};

const CLUSTER_WIDTH = 420;

/** Pointy-top hexagon vertices, center (cx, cy), center-to-vertex radius r. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angleRad = ((-90 + i * 60) * Math.PI) / 180;
    points.push(`${(cx + r * Math.cos(angleRad)).toFixed(1)},${(cy + r * Math.sin(angleRad)).toFixed(1)}`);
  }
  return points.join(' ');
}

/** The hex clip shape (pointy-top) as a CSS `clip-path` polygon - used by the large engraving tile below. */
export const HEX_CLIP_PATH = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

/**
 * Authored in a `CLUSTER_WIDTH`-wide box where HIGH x is the true page
 * edge and LOW x is toward the content. Widened and pushed further into
 * the box (2026-08-26 - the owner said the pattern was too narrowed to
 * the margins) - the dense area now spans roughly 270-420 instead of the
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

/**
 * Fixed outline hexagons shared by every placement - only the 2 icon
 * slots vary per `IconPair`. Densified 2026-08-26 (the owner asked for
 * more hexes overall) with 3 more small ones filling the gaps.
 */
const EXTRA_OUTLINE: readonly HexSpec[] = [
  { cx: 395, cy: 40, r: 24 },
  { cx: 270, cy: 155, r: 18 },
  { cx: 400, cy: 235, r: 22 },
  { cx: 275, cy: 395, r: 16 },
  { cx: 360, cy: 465, r: 24 },
  { cx: 400, cy: 565, r: 22 },
  { cx: 340, cy: 610, r: 26 },
  { cx: 235, cy: 75, r: 13 },
  { cx: 235, cy: 270, r: 14 },
  { cx: 240, cy: 500, r: 13 },
];

function extraHexagonsFor(icons: IconPair): readonly HexSpec[] {
  return [
    ...EXTRA_OUTLINE,
    { cx: 350, cy: 125, r: 28, icon: icons[0] },
    { cx: 345, cy: 350, r: 30, icon: icons[1] },
  ];
}

export function Hexagon({ cx, cy, r, icon: Icon }: HexSpec) {
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
 * A large "material tile" hex showing one of the original engraved-line-art
 * illustrations (`engravings.tsx`) - rewritten 2026-08-26 to replace the
 * real-photo version. A real photo here would always duplicate one already
 * shown on a category tile, product card, or blog post (all 7 sourced
 * photos are already spread across those three surfaces), which is exactly
 * the repetition the owner flagged. An original illustration is guaranteed
 * distinct, and - since the owner separately asked for hex content to
 * "look engraved" - is a better fit than a photo either way. Pure inline
 * SVG (the engraving components render their own `<svg>`), no
 * `next/image`, no new network request.
 */
export function HexEngravingTile({
  engraving: Engraving,
  cx,
  cy,
  size,
  opacity = 0.5,
  className,
}: {
  readonly engraving: EngravingComponent;
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly opacity?: number;
  readonly className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        clipPath: HEX_CLIP_PATH,
        overflow: 'hidden',
        opacity,
        color: 'var(--mui-palette-secondary-main)',
      }}
    >
      <Engraving style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

type SectionDecorationProps = {
  readonly side?: 'left' | 'right';
  readonly icons: IconPair;
  /** One original engraved illustration for one large accent hex - optional, used sparingly (a few placements sitewide). */
  readonly engraving?: EngravingComponent;
};

/**
 * A honeycomb accent for a `Section`. Pure inline-SVG RSC primitive:
 * `aria-hidden`, `pointer-events: none`, zero client JS.
 *
 * The cluster is authored once with its dense side at HIGH local x; for
 * `side="right"` that's flush against the section's right edge as-is, and
 * for `side="left"` the inner wrapper (svg + engraving tile) is mirrored
 * (`scaleX(-1)`) rather than duplicating hand-placed coordinates - safe
 * here even for the engraving tile, since these are abstract/near-
 * symmetric illustrations, not real photos where a flip would look wrong.
 */
export function SectionDecoration({ side = 'right', icons, engraving }: SectionDecorationProps) {
  const fadeToward = side === 'right' ? 'left' : 'right';
  // Pushed further into the page (2026-08-26) - opaque through most of the
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
        {engraving && (
          <HexEngravingTile engraving={engraving} cx={330} cy={300} size={160} className="hex-extra" />
        )}
      </div>
    </div>
  );
}

import type { CSSProperties } from 'react';

type EngravingProps = {
  readonly style?: CSSProperties;
};

/**
 * Original, hand-authored line-art illustrations in an "engraved wood art"
 * style — added 2026-08-26 so the hexagon decorations and the hero mosaic
 * have real content that (a) actually looks engraved, per the owner's
 * request, and (b) is guaranteed not to duplicate any of the real sourced
 * photography already used for categories/products/blog (all 7 stock
 * photos are already spread across those three surfaces; reusing any of
 * them a third or fourth time in decoration is exactly the repetition the
 * owner flagged). Pure `stroke="currentColor"` line art, no fill except
 * where noted — tint via the parent's CSS `color`, same convention as
 * `src/ui/icons/index.tsx`. `viewBox="0 0 200 200"`, centered on
 * (100, 100), so every illustration drops into a hex tile or the mosaic
 * at any size without adjustment.
 */

/** An 8-petal radiating botanical mandala — the richest of the five, used for the hero's big honeycomb mosaic. */
export function BotanicalEngraving({ style }: EngravingProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" style={style} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx={100} cy={100} r={70} strokeOpacity={0.35} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <path key={angle} d="M100,86 Q88,50 100,14 Q112,50 100,86 Z" transform={`rotate(${angle} 100 100)`} />
      ))}
      <circle cx={100} cy={100} r={13} />
    </svg>
  );
}

/** Concentric circles + an 8-point radiating star with tick marks — a precision/compass motif for CNC work. */
export function GeometricEngraving({ style }: EngravingProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" style={style} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx={100} cy={100} r={80} />
      <circle cx={100} cy={100} r={52} strokeOpacity={0.5} />
      {[0, 45, 90, 135].map((angle) => (
        <line key={angle} x1={28} y1={100} x2={172} y2={100} transform={`rotate(${angle} 100 100)`} />
      ))}
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((angle) => (
        <line key={angle} x1={100} y1={16} x2={100} y2={28} transform={`rotate(${angle} 100 100)`} />
      ))}
      <circle cx={100} cy={100} r={6} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Flowing horizontal contour lines — a wood-grain motif. */
export function WaveGrainEngraving({ style }: EngravingProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" style={style} fill="none" stroke="currentColor" strokeWidth={2}>
      {[35, 65, 95, 125, 155, 175].map((y, index) => (
        <path
          key={y}
          d={`M-10,${y} Q45,${y - 16} 100,${y} T210,${y}`}
          strokeOpacity={index % 2 === 0 ? 0.9 : 0.55}
        />
      ))}
    </svg>
  );
}

/** A 4-line, 8-point compass star — a navigation/precision motif, distinct from the geometric tick-mark version. */
export function CompassEngraving({ style }: EngravingProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" style={style} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx={100} cy={100} r={75} strokeOpacity={0.4} />
      {[0, 45, 90, 135].map((angle) => (
        <line key={angle} x1={25} y1={100} x2={175} y2={100} transform={`rotate(${angle} 100 100)`} />
      ))}
      <circle cx={100} cy={100} r={7} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A single curved branch with alternating leaves — simpler and smaller than the full mandala, for tighter tiles. */
export function LeafSprigEngraving({ style }: EngravingProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" style={style} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M25,175 Q100,140 175,25" />
      {(
        [
          [55, 155, 40, 175],
          [80, 125, 100, 145],
          [105, 100, 130, 115],
          [128, 72, 150, 85],
          [150, 45, 168, 55],
        ] as const
      ).map(([bx, by, tx, ty]) => (
        <path key={`${bx}-${by}`} d={`M${bx},${by} Q${(bx + tx) / 2 + 10},${(by + ty) / 2 - 6} ${tx},${ty}`} />
      ))}
    </svg>
  );
}

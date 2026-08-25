import { hexPoints } from '@/ui/primitives/SectionDecoration';

/**
 * Rewritten 2026-08-26 at the owner's explicit request: not several
 * independent hex tiles each with their own small image, but one real
 * honeycomb tessellation — 10 adjacent hex cells (within the "7-12" the
 * owner asked for) that collectively reveal ONE illustration, like a
 * stained-glass or mosaic reconstruction of a single picture, with thin
 * gaps between cells so the honeycomb structure stays visible. The
 * illustration is an original engraved-line-art botanical mandala (see
 * `engravings.tsx`'s header for why this is drawn rather than a reused
 * photo — every real photo on the site is already spread across
 * categories/products/blog, so reusing one here would be exactly the
 * duplication the owner flagged).
 *
 * A same-day follow-up asked for the underlying picture to be a real
 * photo, and for it to move independently behind the hexes on scroll
 * (real scroll-linked parallax). That's real, separate work — not done
 * here yet, noted in `docs/HANDOVER.md` — and a first attempt at a
 * simpler "let it bleed past the section" version (an oversized,
 * absolutely-positioned, `overflow: visible` SVG) turned out to be a real
 * bug: at certain viewport heights it collapsed the entire page to a
 * narrow column (reproduced at 1401x1000, fine at 1401x800 — a genuine
 * layout bug, not a screenshot artifact). Reverted to a normal,
 * fully-contained block element here rather than ship something that
 * broke the page at some real viewport sizes.
 */

/** Slightly smaller than the 45px tessellation spacing baked into `CELLS` below, so adjacent cells show a visible gap instead of touching edge-to-edge. */
const CLIP_R = 40;

const CELLS: readonly { readonly cx: number; readonly cy: number }[] = [
  { cx: 85, cy: 75 },
  { cx: 163, cy: 75 },
  { cx: 241, cy: 75 },
  { cx: 124, cy: 142 },
  { cx: 202, cy: 142 },
  { cx: 85, cy: 210 },
  { cx: 163, cy: 210 },
  { cx: 241, cy: 210 },
  { cx: 124, cy: 277 },
  { cx: 202, cy: 277 },
];

export function HeroHexMosaic() {
  return (
    <div aria-hidden="true" style={{ width: '100%', maxWidth: 320, marginInline: 'auto' }}>
      <svg aria-hidden="true" viewBox="0 0 300 350" width="100%">
        <defs>
          <clipPath id="hero-mosaic-clip">
            {CELLS.map((cell) => (
              <polygon key={`${cell.cx}-${cell.cy}`} points={hexPoints(cell.cx, cell.cy, CLIP_R)} />
            ))}
          </clipPath>
        </defs>

        <g clipPath="url(#hero-mosaic-clip)" style={{ color: 'var(--mui-palette-secondary-main)' }}>
          <rect x={0} y={0} width={300} height={350} fill="var(--mui-palette-background-paper)" />
          <g transform="translate(163, 175)" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 2.5 }}>
            <circle r={140} strokeOpacity={0.3} />
            <circle r={95} strokeOpacity={0.5} />
            {Array.from({ length: 12 }, (_, i) => i * 30).map((angle) => (
              <path
                key={angle}
                d="M0,-30 Q-24,-90 0,-155 Q24,-90 0,-30"
                transform={`rotate(${angle})`}
                strokeOpacity={0.85}
              />
            ))}
            <circle r={26} fill="currentColor" stroke="none" fillOpacity={0.9} />
          </g>
        </g>

        {/* Thin outlines on top of the artwork so each cell reads as a distinct hex tile, not just a clipped shape. */}
        <g fill="none" stroke="var(--mui-palette-secondary-main)" strokeWidth={1.5} strokeOpacity={0.35}>
          {CELLS.map((cell) => (
            <polygon key={`outline-${cell.cx}-${cell.cy}`} points={hexPoints(cell.cx, cell.cy, CLIP_R)} />
          ))}
        </g>
      </svg>
    </div>
  );
}

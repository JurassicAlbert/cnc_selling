import { hexPoints } from '@/ui/primitives/SectionDecoration';

/**
 * Rewritten 2026-08-26 at the owner's explicit request (`docs/HANDOVER.md`
 * §9v): the honeycomb tessellation now tapers 2-3-4-3-2 across 5 rows so
 * the 14 cells collectively read as ONE BIG HEXAGON silhouette, not the
 * rectangular 3-2-3-2 block from the previous pass. The artwork behind
 * the hexes is now a real photo — `obrazy-drewniane.jpg`, an actual
 * laser-cut engraved wood piece already sourced for the "Obrazy
 * drewniane" category (reused deliberately: it's the single best
 * representation of "engraved wood art" in the site's photo set, and the
 * hero is a different context — a fragmented textural background, not a
 * product thumbnail, so the reuse doesn't read as duplication the way it
 * would on two product cards).
 *
 * The image is rendered oversized relative to its clip window and
 * translated via a CSS `view()` scroll timeline (`animation-timeline:
 * view()`) — no JavaScript. As the section scrolls through the viewport,
 * progress drives a `translateY` on the image, so it visibly "overflows"
 * and shifts independently of the static hex outlines above it (the
 * requested parallax). `view()` ties animation progress to this
 * element's own visibility in its scroll container, so it needs no named
 * timeline set up elsewhere. Browsers without `animation-timeline`
 * support (older Safari) simply skip the animation and show a static
 * image — a clean degrade, not a broken one. `prefers-reduced-motion:
 * reduce` disables it outright. This is a materially different approach
 * from the earlier abandoned attempt (`overflow-y: visible` on the whole
 * mosaic/section, reverted for collapsing the page layout at some
 * viewport heights) — here the hex clip shapes stay fixed and fully
 * contained; only the image *within* them moves, so `Section.tsx`'s
 * `overflow: hidden` needs no change at all.
 */

/** Slightly smaller than the 78px column / 67.5px row tessellation spacing baked into `CELLS` below, so adjacent cells show a visible gap instead of touching edge-to-edge. */
const CLIP_R = 40;

/** 2-3-4-3-2 across 5 rows (14 cells) — a symmetric taper that reads as one big hexagon, not a rectangle. Rows alternate between two column phases 39px apart, matching pointy-top hex tessellation math (column spacing = sqrt(3) * CLIP_R ≈ 78, row spacing = 1.5 * CLIP_R ≈ 67.5). */
const CELLS: readonly { readonly cx: number; readonly cy: number }[] = [
  { cx: 131, cy: 40 },
  { cx: 209, cy: 40 },
  { cx: 92, cy: 108 },
  { cx: 170, cy: 108 },
  { cx: 248, cy: 108 },
  { cx: 53, cy: 175 },
  { cx: 131, cy: 175 },
  { cx: 209, cy: 175 },
  { cx: 287, cy: 175 },
  { cx: 92, cy: 242 },
  { cx: 170, cy: 242 },
  { cx: 248, cy: 242 },
  { cx: 131, cy: 310 },
  { cx: 209, cy: 310 },
];

export function HeroHexMosaic() {
  return (
    <div aria-hidden="true" style={{ width: '100%', maxWidth: 380, marginInline: 'auto' }}>
      <style>{`
        @keyframes hero-mosaic-parallax {
          from { transform: translateY(-7%); }
          to { transform: translateY(7%); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .hero-mosaic-image {
            animation: hero-mosaic-parallax linear both;
            animation-timeline: view();
          }
        }
      `}</style>
      <svg aria-hidden="true" viewBox="0 0 340 350" width="100%">
        <defs>
          <clipPath id="hero-mosaic-clip">
            {CELLS.map((cell) => (
              <polygon key={`${cell.cx}-${cell.cy}`} points={hexPoints(cell.cx, cell.cy, CLIP_R)} />
            ))}
          </clipPath>
        </defs>

        <g clipPath="url(#hero-mosaic-clip)">
          <rect x={0} y={0} width={340} height={350} fill="var(--mui-palette-background-paper)" />
          <image
            className="hero-mosaic-image"
            href="/images/photos/obrazy-drewniane.jpg"
            x={-20}
            y={-45}
            width={380}
            height={490}
            preserveAspectRatio="xMidYMid slice"
          />
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

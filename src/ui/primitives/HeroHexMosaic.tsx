'use client';

import { useEffect, useRef } from 'react';

import { hexPoints } from '@/ui/primitives/SectionDecoration';

/**
 * Rewritten again 2026-08-26 per the owner's follow-up: the previous
 * 2-3-4-3-2 taper (14 cells) still read as a rounded blob/flower, not a
 * crisp hexagon. The reason: 2-3-4-3-2 isn't a valid ring pattern for a
 * hex-of-hexagons at all. A true hexagon built from pointy-top hex cells
 * only exists for "radius N" sizes, where row `r` (|r| <= N) holds
 * `2N + 1 - |r|` cells - radius 1 is rows 2-3-2 (7 cells), radius 2 is
 * rows 3-4-5-4-3 (19 cells). This file now uses radius 2 (19 cells),
 * computed from real axial hex coordinates (`x = size*sqrt(3)*(q+r/2)`,
 * `y = size*1.5*r`) rather than hand-tuned pixel offsets, so the
 * silhouette is mathematically a hexagon, not an approximation of one.
 *
 * The artwork behind the hexes is a real photo - `obrazy-drewniane.jpg`,
 * an actual laser-cut engraved wood piece already sourced for the
 * "Obrazy drewniane" category (reused deliberately: it's the single best
 * representation of "engraved wood art" in the site's photo set, and the
 * hero is a different context - a fragmented textural background, not a
 * product thumbnail).
 *
 * PARALLAX: this is the first client-side JS in this codebase for a
 * purely decorative element - every other primitive here
 * (`OrbitIconHero`, `SectionDecoration`, the rest of this file) is
 * deliberately zero-JS. That convention is broken here on purpose. The
 * first attempt used a pure-CSS `animation-timeline: view()` scroll
 * timeline - correctly attached (verified via `element.getAnimations()`
 * showing a running effect), but its `currentTime`/progress never
 * advanced under either programmatic (`window.scrollTo`) or simulated
 * wheel scrolling in this project's browser-automation tooling, across
 * repeated tests, so it couldn't be verified actually moving - and the
 * owner had already asked twice for confirmed movement. Rather than ship
 * an effect nobody could confirm works, this uses a small
 * `requestAnimationFrame`-throttled scroll listener that's directly
 * verifiable: read the element's `getBoundingClientRect()`, compute how
 * far it's transited the viewport (0 = just entering the bottom, 1 =
 * just leaving the top), map that to a ±40px `translateY`. Respects
 * `prefers-reduced-motion: reduce` (skips attaching listeners entirely,
 * leaving the image at its static baseline position - still a complete,
 * correct image, just not moving). The hex clip shapes stay fixed and
 * fully contained; only the image *within* them moves, so
 * `Section.tsx`'s `overflow: hidden` needs no change.
 *
 * Same-day fixes: (1) the 19-cell layout was drawing each hexagon at the
 * SAME radius used to space their centers (`sqrt(3) * r` apart), which
 * is exactly the distance at which two same-radius pointy-top hexagons
 * touch - zero gap, cells looked fused. Fixed by separating `SPACING_R`
 * (centers) from a smaller `CLIP_R` (the drawn shape). (2) the cluster
 * grew from 19 cells (radius 2) to 37 (radius 3) and from a 520px to a
 * 700px container, with the gap tightened back up slightly (`CLIP_R`/
 * `SPACING_R` ratio 0.78 → 0.88) - more, bigger, a little tighter, all
 * per the owner's follow-up. The hero grid's column ratio also moved
 * from `1fr 1fr` to `1fr 1.3fr` (`(marketing)/page.tsx`) to give the
 * now-bigger mosaic room without starving the text column.
 *
 * VIDEO: the static photo was then swapped for a real short video loop
 * of the actual carving process - `public/videos/hero-carving.mp4`, cut
 * from a Pexels-licensed CNC close-up the owner provided (source: a
 * 116MB 2160x4096 25fps clip; a 55MB GIF export of it was also offered
 * but rejected here - a GIF that size would be a serious page-weight
 * regression this project's Lighthouse-driven discipline wouldn't
 * accept, and H.264 video is strictly better for a looping clip like
 * this: much smaller for the same quality, hardware-decoded). Re-encoded
 * with ffmpeg: cropped to this mosaic's aspect ratio, scaled to 960x846,
 * 24fps, a 6s loop, H.264/yuv420p, no audio - 523KB. Swapping from
 * `<image>` to a `<video>` inside an SVG needs `<foreignObject>` (SVG
 * has no native video element); everything else - the clip-path
 * `<g>`, the oversize-for-parallax x/y/width/height, the scroll
 * handler's `getBoundingClientRect()`/`style.transform` approach -
 * carries over unchanged, since a `<video>` is a normal HTML element
 * once inside the foreignObject and behaves identically to the `<image>`
 * it replaced for sizing, clipping, and the parallax transform.
 *
 * `poster="/videos/hero-carving-poster.jpg"` is the video's own first
 * frame (`ffmpeg -i hero-carving.mp4 -frames:v 1`, 30KB) - shown while
 * the video downloads/decodes instead of a blank paper-color rect.
 */

/**
 * Two different radii on purpose: cell *centers* are laid out using
 * `SPACING_R` (the true axial hex-grid spacing math below), but each
 * hexagon is *drawn* smaller, at `CLIP_R`, so there's a real visible gap
 * between neighbors instead of them touching edge-to-edge. Drawing at
 * the same radius used for spacing (an earlier version of this file did
 * that) leaves zero gap - `sqrt(3) * r` is exactly the center-to-center
 * distance at which two same-radius pointy-top hexagons touch.
 */
const SPACING_R = 48;
const CLIP_R = 42;

/**
 * Ring radius of the hex-of-hexagons - row `r` (|r| <= HEX_RADIUS) holds
 * `2*HEX_RADIUS + 1 - |r|` cells. 2 gives rows 3-4-5-4-3 (19 cells).
 * Dropped from 3 (37 cells) back to 2 per the owner's follow-up -
 * "bigger hexes so we need them less" - with `SPACING_R`/`CLIP_R` scaled
 * up so the CLUSTER's overall footprint stays the same as the 37-cell
 * version (still spans the same ~420x370 viewBox), just built from fewer,
 * larger cells instead of more, smaller ones.
 */
const HEX_RADIUS = 2;
const CENTER_X = 210;
const CENTER_Y = 185;

/** Builds true axial hex-grid coordinates (`x = SPACING_R*sqrt(3)*(q+r/2)`, `y = SPACING_R*1.5*r`) for every cell within `HEX_RADIUS` rings of center, converted to pixel centers. Generated rather than hand-typed so the "this is a real hexagon, not an approximation" claim in this file's header is self-verifying. */
function buildHexOfHexCells(): { readonly cx: number; readonly cy: number }[] {
  const cells: { cx: number; cy: number }[] = [];
  for (let r = -HEX_RADIUS; r <= HEX_RADIUS; r++) {
    const qMin = Math.max(-HEX_RADIUS, -HEX_RADIUS - r);
    const qMax = Math.min(HEX_RADIUS, HEX_RADIUS - r);
    for (let q = qMin; q <= qMax; q++) {
      cells.push({
        cx: Math.round(SPACING_R * Math.sqrt(3) * (q + r / 2) + CENTER_X),
        cy: Math.round(SPACING_R * 1.5 * r + CENTER_Y),
      });
    }
  }
  return cells;
}

const CELLS = buildHexOfHexCells();

/** Max upward/downward shift, in px, matching the image's oversize margin (see the `<image>` element below). */
const PARALLAX_RANGE_PX = 40;

export function HeroHexMosaic() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const applyOffset = () => {
      frame = 0;
      const rect = video.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      const progress = Math.min(1, Math.max(0, 1 - (rect.top + rect.height) / total));
      const offset = -PARALLAX_RANGE_PX + progress * (2 * PARALLAX_RANGE_PX);
      video.style.transform = `translateY(${offset}px)`;
    };
    const onScrollOrResize = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(applyOffset);
    };

    applyOffset();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" style={{ width: '100%', maxWidth: 700, marginInline: 'auto' }}>
      <svg aria-hidden="true" viewBox="0 0 420 370" width="100%">
        <defs>
          <clipPath id="hero-mosaic-clip">
            {CELLS.map((cell) => (
              <polygon key={`${cell.cx}-${cell.cy}`} points={hexPoints(cell.cx, cell.cy, CLIP_R)} />
            ))}
          </clipPath>
        </defs>

        <g clipPath="url(#hero-mosaic-clip)">
          <rect x={0} y={0} width={420} height={370} fill="var(--mui-palette-background-paper)" />
          <foreignObject x={-40} y={-50} width={500} height={470}>
            <video
              ref={videoRef}
              src="/videos/hero-carving.mp4"
              poster="/videos/hero-carving-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </foreignObject>
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

import Image from 'next/image';
import Link from 'next/link';

import { getCategoryIcon } from '@/ui/primitives/category-icon';

type CategoryTileProps = {
  readonly href: string;
  readonly namePl: string;
  readonly imageUrl: string | null;
  readonly categorySlug: string;
  /**
   * Preloads this tile's photo. Renamed from `priority`, deprecated in Next
   * 16 (PERF-06); `get-img-props.js` shows the two are the same switch -
   * `isLazy = !priority && !preload && …` and `preload: preload || priority`.
   *
   * **Nothing sets it today.** It was set on the homepage's first tile
   * because Next flagged that tile as the LCP element, which was true when it
   * was recorded and is not now: measured 2026-09-10, that tile sits 1365 px
   * down a 720 px-tall desktop window and 1537 px down a phone, and the
   * homepage's real LCP element is the hero `<video>` poster. Kept as a prop
   * rather than deleted because it is the right switch for a page whose hero
   * IS a tile.
   */
  readonly preload?: boolean;
};

/**
 * RSC-safe - `next/image` needs no client boundary, and unlike the SVG
 * placeholders `Card.tsx` still serves, these are real photos (sourced
 * stock, see `prisma/seed.ts`'s header), so Next's raster pipeline
 * (responsive sizing, lazy loading, format negotiation) is a genuine win
 * here rather than dead weight.
 */
export function CategoryTile({ href, namePl, imageUrl, categorySlug, preload = false }: CategoryTileProps) {
  const Icon = getCategoryIcon(categorySlug);

  return (
    <Link
      href={href}
      className="category-tile"
      style={{
        position: 'relative',
        aspectRatio: '4 / 5',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {imageUrl !== null && (
        // Decorative: the visible <span> below already labels the link, and
        // an `alt` here too would announce the name twice to screen readers
        // ("Loft Loft") - a real accessibility duplication, caught by a
        // Playwright locator that ended up matching it for the same reason.
        <Image
          src={imageUrl}
          alt=""
          fill
          /*
            BUG-26 named `ProductCard` only, and its parenthetical says image
            serving is otherwise correct - but measuring it found this tile
            carrying the identical mistake, so it is fixed on evidence rather
            than left because a list did not mention it. At 375 px the tile
            renders 327 px, 87vw, against a declared 50vw.

            Measured across the range: 375->327, 600->264, 768->221,
            1000->218, 1600->211. Simpler than the product card - one column,
            then two, then a size that barely moves - so it needs three stops
            rather than four.
          */
          sizes="(max-width: 599px) 88vw, (max-width: 767px) 45vw, 240px"
          style={{ objectFit: 'cover' }}
          preload={preload}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(31,29,27,0.65), rgba(31,29,27,0) 55%)',
        }}
      />
      <span className="card-icon-badge" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span
        style={{
          position: 'absolute',
          insetInline: 16,
          bottom: 16,
          font: 'var(--mui-font-h6)',
          color: '#ffffff',
        }}
      >
        {namePl}
      </span>
    </Link>
  );
}

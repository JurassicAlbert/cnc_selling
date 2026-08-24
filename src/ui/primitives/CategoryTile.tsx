import Image from 'next/image';
import Link from 'next/link';

type CategoryTileProps = {
  readonly href: string;
  readonly namePl: string;
  readonly imageUrl: string | null;
  /** Set on the first tile only — Next.js flagged it as the LCP element (real Playwright output, not guessed). */
  readonly priority?: boolean;
};

/**
 * RSC-safe — `next/image` needs no client boundary, and unlike the SVG
 * placeholders `Card.tsx` still serves, these are real photos (sourced
 * stock, see `prisma/seed.ts`'s header), so Next's raster pipeline
 * (responsive sizing, lazy loading, format negotiation) is a genuine win
 * here rather than dead weight.
 */
export function CategoryTile({ href, namePl, imageUrl, priority = false }: CategoryTileProps) {
  return (
    <Link
      href={href}
      style={{
        position: 'relative',
        display: 'block',
        aspectRatio: '4 / 5',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {imageUrl !== null && (
        // Decorative: the visible <span> below already labels the link, and
        // an `alt` here too would announce the name twice to screen readers
        // ("Loft Loft") — a real accessibility duplication, caught by a
        // Playwright locator that ended up matching it for the same reason.
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          style={{ objectFit: 'cover' }}
          priority={priority}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(31,29,27,0.65), rgba(31,29,27,0) 55%)',
        }}
      />
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

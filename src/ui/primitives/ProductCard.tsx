import Image from 'next/image';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';

type ProductCardProps = {
  readonly href: string;
  readonly namePl: string;
  readonly categoryNamePl: string;
  readonly imageUrl: string | null;
  readonly minPriceGrosze: number;
  /** Set on the homepage's first card only — see CategoryTile.tsx's comment on why this matters. */
  readonly priority?: boolean;
};

/**
 * The v2 product card — image, category label, name, real price. Deliberately
 * NOT a star rating or review count: the brief forbids fabricating reviews
 * (§16A.1 module 9), and a rating is the same category of invented content.
 * No reference template's card gets copied wholesale; this one only shows
 * what's real.
 */
export function ProductCard({
  href,
  namePl,
  categoryNamePl,
  imageUrl,
  minPriceGrosze,
  priority = false,
}: ProductCardProps) {
  return (
    <Link
      href={href}
      className="product-card"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        className="product-card-media"
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          backgroundColor: 'var(--mui-palette-background-paper)',
          border: '1px solid var(--mui-palette-divider)',
        }}
      >
        {imageUrl !== null && (
          // Decorative: the visible name below already labels the link — see
          // CategoryTile.tsx's comment for why a second `alt` here would be
          // a real duplication, not just a test-locator inconvenience.
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 280px"
            style={{ objectFit: 'cover' }}
            priority={priority}
          />
        )}
      </div>
      <div style={{ paddingTop: 'var(--space-3)' }}>
        <div
          style={{
            font: 'var(--mui-font-caption)',
            color: 'var(--mui-palette-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {categoryNamePl}
        </div>
        <div style={{ font: 'var(--mui-font-subtitle1)', color: 'var(--mui-palette-text-primary)' }}>
          {namePl}
        </div>
        <div style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-primary)' }}>
          {SITE.catalogueStartingPricePrefixPl} {formatPln(minPriceGrosze)}
        </div>
      </div>
    </Link>
  );
}

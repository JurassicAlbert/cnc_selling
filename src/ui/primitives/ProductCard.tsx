import Image from 'next/image';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { DrawIcon } from '@/ui/icons';
import { getCategoryIcon } from '@/ui/primitives/category-icon';

type ProductCardProps = {
  readonly href: string;
  readonly namePl: string;
  readonly categoryNamePl: string;
  readonly categorySlug: string;
  readonly imageUrl: string | null;
  readonly minPriceGrosze: number;
  /** Real, from `PersonalizationSpec.isEnabled` — not every product offers it. */
  readonly hasPersonalization: boolean;
  /** Set on the homepage's first card only — see CategoryTile.tsx's comment on why this matters. */
  readonly priority?: boolean;
};

/**
 * The v2 product card — image, category label, name, real price, plus two
 * badges added 2026-08-25: the category icon (top-left, same mapping
 * `CategoryTile` uses) and a "Grawer" pill (top-right) when the product
 * genuinely has personalization enabled — real data, not shown on every
 * card. Deliberately NOT a star rating or review count: the brief forbids
 * fabricating reviews (§16A.1 module 9), and a rating is the same category
 * of invented content. No reference template's card gets copied wholesale;
 * this one only shows what's real.
 */
export function ProductCard({
  href,
  namePl,
  categoryNamePl,
  categorySlug,
  imageUrl,
  minPriceGrosze,
  hasPersonalization,
  priority = false,
}: ProductCardProps) {
  const CategoryIcon = getCategoryIcon(categorySlug);

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
        <span className="card-icon-badge" aria-hidden="true">
          <CategoryIcon size={18} />
        </span>
        {hasPersonalization && (
          <span className="card-personalization-badge">
            <DrawIcon size={14} />
            {SITE.cardPersonalizationBadgePl}
          </span>
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

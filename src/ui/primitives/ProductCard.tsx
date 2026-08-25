import Image from 'next/image';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { SITE } from '@/content/pl/site';
import { AccessTimeIcon, DrawIcon } from '@/ui/icons';
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
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly materials: readonly { readonly namePl: string }[];
  /** Set on the homepage's first card only — see CategoryTile.tsx's comment on why this matters. */
  readonly priority?: boolean;
};

/**
 * The v2 product card — image, category label, name, real price, two image
 * badges (category icon + a "Grawer" pill only when personalization is
 * genuinely enabled), and — added 2026-08-25, round 2 — a compact facts row
 * (production time, width range) plus a material chip, all real DB fields,
 * to make the card more informative without inventing anything (no rating,
 * no "bestseller"/popularity claim — §16A.1 module 9 forbids fabricated
 * social proof, and this project has followed that everywhere). `materials`
 * is a real many-to-many join; every seeded product has exactly one today,
 * but this renders the first plus a "+N" suffix so it doesn't silently
 * break if a product ever has more.
 */
export function ProductCard({
  href,
  namePl,
  categoryNamePl,
  categorySlug,
  imageUrl,
  minPriceGrosze,
  hasPersonalization,
  productionDaysMin,
  productionDaysMax,
  minWidthMm,
  maxWidthMm,
  materials,
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
        <div
          style={{
            marginBlockStart: 'var(--space-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            font: 'var(--mui-font-caption)',
            color: 'var(--mui-palette-text-secondary)',
          }}
        >
          <AccessTimeIcon size={13} />
          {productionDaysMin}–{productionDaysMax} {SITE.catalogueProductionTimeUnitPl}
          <span aria-hidden="true">·</span>
          {formatMmAsCentimetres(minWidthMm)}–{formatMmAsCentimetres(maxWidthMm)} cm
        </div>
        {materials.length > 0 && (
          <div style={{ marginBlockStart: 'var(--space-2)' }}>
            <span className="material-chip">
              {materials[0]?.namePl}
              {materials.length > 1 ? ` +${materials.length - 1}` : ''}
            </span>
          </div>
        )}
        <div
          style={{
            marginBlockStart: 'var(--space-2)',
            font: 'var(--mui-font-body2)',
            color: 'var(--mui-palette-text-primary)',
          }}
        >
          {SITE.catalogueStartingPricePrefixPl} {formatPln(minPriceGrosze)}
        </div>
      </div>
    </Link>
  );
}

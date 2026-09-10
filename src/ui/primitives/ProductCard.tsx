import Image from 'next/image';
import type { MaterialChoice } from '@/domain/catalogue/material-summary';
import { summariseMaterials } from '@/domain/catalogue/material-summary';
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
  /**
   * GROSS, and the cheapest configuration a customer can actually buy
   * (`server/pricing/starting-price.ts`). `null` renders no price at all -
   * never zero, and never a fallback to `minPriceGrosze`, which is the net
   * internal clamp this card used to advertise
   * (`docs/REVIEW-DETAILED.md` BUG-02).
   */
  readonly startingPriceGrossGrosze: number | null;
  /** Real, from `PersonalizationSpec.isEnabled` - not every product offers it. */
  readonly hasPersonalization: boolean;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly materials: readonly MaterialChoice[];
  /**
   * Preloads this card's photo - renamed from `priority` (PERF-06). Set only
   * where the card is genuinely the LCP element; measured 2026-09-10, the
   * homepage's first card is 1905 px down on desktop and 3496 px down on a
   * phone, so it is not set there any more.
   */
  readonly preload?: boolean;
};

/**
 * The v2 product card - image, category label, name, real price, two image
 * badges (category icon + a "Grawer" pill only when personalization is
 * genuinely enabled), and - added 2026-08-25, round 2 - a compact facts row
 * (production time, width range) plus a material chip, all real DB fields,
 * to make the card more informative without inventing anything (no rating,
 * no "bestseller"/popularity claim - §16A.1 module 9 forbids fabricated
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
  startingPriceGrossGrosze,
  hasPersonalization,
  productionDaysMin,
  productionDaysMax,
  minWidthMm,
  maxWidthMm,
  materials,
  preload = false,
}: ProductCardProps) {
  const CategoryIcon = getCategoryIcon(categorySlug);
  const materialSummary = summariseMaterials(materials);


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
          // Decorative: the visible name below already labels the link - see
          // CategoryTile.tsx's comment for why a second `alt` here would be
          // a real duplication, not just a test-locator inconvenience.
          <Image
            src={imageUrl}
            alt=""
            fill
            /*
              BUG-26, re-measured on 2026-09-10 rather than taken on trust.
              The declaration said 50vw below 768; the card actually renders
              325 px of a 375 px screen - 87vw - so at DPR 2 the browser asked
              for a 384 px file to fill a slot needing about 650. Every phone
              was being served a visibly soft image.

              The rest is measured too, and one number is not what anyone
              would guess: the widest this image ever gets is 331 px at a
              1000 px viewport, because the grid gains a column at 1024 and
              the cards get SMALLER above it (220 px at 1024, 282 px at 1280
              and 1600, where the container caps). 375->325, 600->262,
              768->219, 1000->331, 1024->220, 1100->245, 1280->282, 1600->282.

              Each stop is rounded up, never down: over-declaring costs one
              candidate width, under-declaring is the blur this item is about.
            */
            sizes="(max-width: 599px) 88vw, (max-width: 767px) 45vw, (max-width: 1023px) 34vw, 300px"
            style={{ objectFit: 'cover' }}
            preload={preload}
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
        {/*
         * The `overline` variant, not caption-plus-hand-rolled-uppercase:
         * this eyebrow was setting its own `0.04em` tracking, which is far
         * too tight for uppercase text and is exactly the arbitrary inline
         * value the theme exists to replace. `overline` already means
         * "small uppercase label" and now carries real 0.1em tracking
         * (2026-08-30 typography pass).
         */}
        <div
          style={{
            font: 'var(--mui-font-overline)',
            letterSpacing: 'var(--mui-letter-spacing-overline)',
            textTransform: 'uppercase',
            color: 'var(--mui-palette-text-secondary)',
          }}
        >
          {categoryNamePl}
        </div>
        <div
          style={{
            font: 'var(--mui-font-subtitle1)',
            letterSpacing: 'var(--mui-letter-spacing-h5)',
            color: 'var(--mui-palette-text-primary)',
            // Product names are catalogue data of unpredictable length -
            // `pretty` keeps a two-line name from leaving one word alone on
            // the second line, `anywhere` stops an unbroken one overflowing
            // the card. Neither changes where anything sits.
            textWrap: 'pretty',
            overflowWrap: 'anywhere',
          }}
        >
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
        {/*
          UX-17. This chip used to render the first material's name followed
          by "+N" - shorthand only a developer parses, and it also presented
          one arbitrary option as if it were the headline.
          `summariseMaterials` picks the noun from the families rather than
          from the count, because `fartuch-kuchenny-z-grawerem` offers a
          single CERAMIC material and the schema allows plywood, MDF, leather
          and other besides, so "species of wood" is not always true.
        */}
        {materialSummary.kind !== 'none' && (
          <div style={{ marginBlockStart: 'var(--space-2)' }}>
            <span className="material-chip">
              {materialSummary.kind === 'single'
                ? materialSummary.namePl
                : materialSummary.kind === 'wood'
                  ? SITE.catalogueMaterialsWoodPl(materialSummary.count)
                  : SITE.catalogueMaterialsMixedPl(materialSummary.count)}
            </span>
          </div>
        )}
        {/*
         * `subtitle2` rather than `body2` - identical size (0.875rem), so
         * nothing reflows, but weight 600 instead of 400. Price is the one
         * thing on a product card a customer is actually comparing, and it
         * was the lightest text in the block: quieter than the product name
         * above it and no heavier than the production-time meta line.
         */}
        <div
          style={{
            marginBlockStart: 'var(--space-2)',
            font: 'var(--mui-font-subtitle2)',
            color: 'var(--mui-palette-text-primary)',
          }}
        >
          {startingPriceGrossGrosze === null
            ? SITE.catalogueIndividualQuotePl
            : `${SITE.catalogueStartingPricePrefixPl} ${formatPln(startingPriceGrossGrosze)}`}
        </div>
      </div>
    </Link>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { listPublishedBlogPosts } from '@/server/repositories/blog';
import { listActiveCategories } from '@/server/repositories/categories';
import { listFaqTeaser } from '@/server/repositories/faq';
import { listAllActiveProducts } from '@/server/repositories/products';
import { listApprovedReviews } from '@/server/repositories/reviews';
import { CategoryTile } from '@/ui/primitives/CategoryTile';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { CompassEngraving, GeometricEngraving, LeafSprigEngraving, WaveGrainEngraving } from '@/ui/primitives/engravings';
import { HeroHexMosaic } from '@/ui/primitives/HeroHexMosaic';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
import { ICON_PAIRS } from '@/ui/primitives/SectionDecoration';
import { Text } from '@/ui/primitives/Text';
import { TrustBadgeStrip } from '@/ui/primitives/TrustBadgeStrip';
import { SITE } from '@/content/pl/site';

/**
 * A Server Component. No `@mui/material` import — `biome.json`'s `overrides`
 * enforces that for every file under `(marketing)` and `(shop)`.
 *
 * Redesigned 2026-08-24 to match the density of the owner's chosen reference
 * (Bazaar `fashion-2`) — hero, trust badges, category tiles, one honest
 * product grid — while keeping every rule the previous pass established:
 * no fabricated reviews/ratings, no fake multi-curated product sections (one
 * real "Nasze produkty" grid, not four labelled the way a much larger
 * catalogue would be), no invented trust claims (the badges state only
 * things actually true of this business). Hero/craftsmanship narrative
 * copy still isn't here — this is real functional chrome, not the
 * owner's-own-words content ARCHITECTURE.md §22 describes, which remains
 * unbuilt.
 */
const blogDateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

export default async function MarketingHomePage() {
  const [categories, products, blogPosts, reviews, faqTeaser] = await Promise.all([
    listActiveCategories(),
    listAllActiveProducts(),
    listPublishedBlogPosts(),
    listApprovedReviews(6),
    listFaqTeaser(4),
  ]);

  return (
    <>
      <Section
        className="hero-surface"
        decorative={[
          { side: 'left', icons: ICON_PAIRS.heroLeft },
          { side: 'right', icons: ICON_PAIRS.heroRight, engraving: GeometricEngraving },
        ]}
      >
        <Container>
          <div style={{ display: 'grid', gap: 48, alignItems: 'center' }} className="hero-grid">
            {/* grid-template-columns lives here, not inline: an inline style always
                wins the cascade over any stylesheet rule, media query included, so
                the responsive override below would otherwise never take effect. */}
            <style>{`
              .hero-grid { grid-template-columns: 1fr; }
              @media (min-width: 900px) {
                /* Wider than 1fr 1fr on purpose — the hex mosaic needs real
                   room to read as a proper hero visual, not a small accent
                   next to the heading (2026-08-26). */
                .hero-grid { grid-template-columns: 1fr 1.3fr; }
              }
            `}</style>
            <div>
              <Heading level={1}>{SITE.heroHeadlinePl}</Heading>
              <div style={{ marginBlockStart: 16, maxWidth: 480 }}>
                <Text muted>{SITE.heroSubcopyPl}</Text>
              </div>
              <div style={{ marginBlockStart: 32 }}>
                <Link
                  href="#kategorie"
                  style={{
                    display: 'inline-block',
                    font: 'var(--mui-font-button)',
                letterSpacing: 'var(--mui-letter-spacing-button)',
                    textTransform: 'none',
                    padding: '12px 28px',
                    borderRadius: 'var(--radius-card)',
                    backgroundColor: 'var(--mui-palette-primary-main)',
                    color: 'var(--mui-palette-background-paper)',
                    textDecoration: 'none',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {SITE.heroCtaPl}
                </Link>
              </div>
            </div>
            <HeroHexMosaic />
          </div>
        </Container>
      </Section>

      <Section surface="paper">
        <Container>
          <TrustBadgeStrip />
        </Container>
      </Section>

      <Section decorative={{ side: 'right', icons: ICON_PAIRS.kategorie, engraving: WaveGrainEngraving }}>
        <Container>
          <div id="kategorie" style={{ scrollMarginTop: 96 }}>
            <Heading level={2}>{SITE.catalogueCategoriesHeadingPl}</Heading>
          </div>
          <div
            style={{
              marginBlockStart: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 24,
            }}
          >
            {categories.map((category, index) => (
              <CategoryTile
                key={category.slug}
                href={`/${category.slug}`}
                namePl={category.namePl}
                imageUrl={category.imageUrl}
                categorySlug={category.slug}
                priority={index === 0}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section surface="paper" decorative={{ side: 'left', icons: ICON_PAIRS.produkty, engraving: CompassEngraving }}>
        <Container>
          <Heading level={2}>{SITE.homeProductsHeadingPl}</Heading>
          <div
            style={{
              marginBlockStart: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            {products.map((product, index) => (
              <ProductCard
                key={product.slug}
                href={`/produkt/${product.slug}`}
                namePl={product.namePl}
                categoryNamePl={product.categoryNamePl}
                categorySlug={product.categorySlug}
                imageUrl={product.primaryImageUrl}
                startingPriceGrossGrosze={product.startingPriceGrossGrosze}
                hasPersonalization={product.hasPersonalization}
                productionDaysMin={product.productionDaysMin}
                productionDaysMax={product.productionDaysMax}
                minWidthMm={product.minWidthMm}
                maxWidthMm={product.maxWidthMm}
                materials={product.materials}
                priority={index === 0}
              />
            ))}
          </div>
        </Container>
      </Section>

      {blogPosts.length > 0 && (
        <Section decorative={{ side: 'right', icons: ICON_PAIRS.blog, engraving: LeafSprigEngraving }}>
          <Container>
            <Heading level={2}>{SITE.homeBlogHeadingPl}</Heading>
            <div
              style={{
                marginBlockStart: 24,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 24,
              }}
            >
              {blogPosts.slice(0, 3).map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  {post.imageUrl !== null && (
                    <div
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 9',
                        borderRadius: 'var(--radius-card)',
                        overflow: 'hidden',
                        marginBlockEnd: 'var(--space-3)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <Image
                        src={post.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>
                    {post.titlePl}
                  </div>
                  <div
                    style={{
                      marginBlockStart: 4,
                      font: 'var(--mui-font-caption)',
                      color: 'var(--mui-palette-text-secondary)',
                    }}
                  >
                    {blogDateFormatter.format(post.publishedAt)}
                  </div>
                  <div style={{ marginBlockStart: 8 }}>
                    <Text muted>{post.shortDescPl}</Text>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ marginBlockStart: 32 }}>
              <Link
                href="/blog"
                className="nav-link"
                style={{ font: 'var(--mui-font-button)',
                letterSpacing: 'var(--mui-letter-spacing-button)', textTransform: 'none' }}
              >
                {SITE.blogViewAllPl}
              </Link>
            </div>
          </Container>
        </Section>
      )}

      {reviews.length > 0 && (
        <Section surface="paper">
          <Container>
            <Heading level={2}>{SITE.homeReviewsHeadingPl}</Heading>
            <div
              style={{
                marginBlockStart: 24,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 24,
              }}
            >
              {reviews.map((review, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, freshly-fetched list, never reordered client-side
                <div key={index} style={{ padding: 24, borderRadius: 'var(--radius-card)', backgroundColor: 'var(--mui-palette-background-default)', boxShadow: 'var(--shadow-sm)' }}>
                  <Text>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                  <div style={{ marginBlockStart: 8 }}>
                    <Text muted>{review.bodyPl}</Text>
                  </div>
                  <div style={{ marginBlockStart: 12, font: 'var(--mui-font-subtitle2)' }}>{review.authorNamePl}</div>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {faqTeaser.length > 0 && (
        <Section>
          <Container>
            <Heading level={2}>{SITE.homeFaqHeadingPl}</Heading>
            <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
              {faqTeaser.map((faq) => (
                <details
                  key={faq.id}
                  style={{ border: '1px solid var(--mui-palette-divider)', borderRadius: 'var(--radius-card)', padding: '16px 20px' }}
                >
                  <summary style={{ font: 'var(--mui-font-h6)', cursor: 'pointer' }}>{faq.questionPl}</summary>
                  <div style={{ marginBlockStart: 12 }}>
                    <Text muted>{faq.answerPl}</Text>
                  </div>
                </details>
              ))}
            </div>
            <div style={{ marginBlockStart: 32 }}>
              <Link href="/faq" className="nav-link" style={{ font: 'var(--mui-font-button)',
                letterSpacing: 'var(--mui-letter-spacing-button)', textTransform: 'none' }}>
                {SITE.faqViewAllPl}
              </Link>
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

export const metadata: Metadata = {
  title: SITE.homeSeoTitlePl,
  description: SITE.homeSeoDescPl,
  alternates: { canonical: '/' },
};

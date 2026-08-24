import type { Metadata } from 'next';
import Link from 'next/link';

import { listActiveCategories } from '@/server/repositories/categories';
import { listAllActiveProducts } from '@/server/repositories/products';
import { CategoryTile } from '@/ui/primitives/CategoryTile';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { OrbitIconHero } from '@/ui/primitives/OrbitIconHero';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
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
export default async function MarketingHomePage() {
  const [categories, products] = await Promise.all([
    listActiveCategories(),
    listAllActiveProducts(),
  ]);

  return (
    <>
      <Section>
        <Container>
          <div style={{ display: 'grid', gap: 48, alignItems: 'center' }} className="hero-grid">
            {/* grid-template-columns lives here, not inline: an inline style always
                wins the cascade over any stylesheet rule, media query included, so
                the responsive override below would otherwise never take effect. */}
            <style>{`
              .hero-grid { grid-template-columns: 1fr; }
              @media (min-width: 900px) {
                .hero-grid { grid-template-columns: 1fr 1fr; }
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
                    textTransform: 'none',
                    padding: '12px 28px',
                    borderRadius: 2,
                    backgroundColor: 'var(--mui-palette-primary-main)',
                    color: 'var(--mui-palette-background-paper)',
                    textDecoration: 'none',
                  }}
                >
                  {SITE.heroCtaPl}
                </Link>
              </div>
            </div>
            <OrbitIconHero />
          </div>
        </Container>
      </Section>

      <Section surface="paper">
        <Container>
          <TrustBadgeStrip />
        </Container>
      </Section>

      <Section>
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
                priority={index === 0}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section surface="paper">
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
                imageUrl={product.primaryImageUrl}
                minPriceGrosze={product.minPriceGrosze}
                priority={index === 0}
              />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

export const metadata: Metadata = {
  title: SITE.homeSeoTitlePl,
  description: SITE.homeSeoDescPl,
  alternates: { canonical: '/' },
};

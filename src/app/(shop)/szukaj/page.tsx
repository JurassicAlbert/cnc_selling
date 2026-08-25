import type { Metadata } from 'next';

import { searchActiveProducts } from '@/server/repositories/products';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type SearchPageProps = {
  readonly searchParams: Promise<{ readonly q?: string }>;
};

/**
 * A real search results page — diacritic-insensitive matching
 * (`matchesPl`/`searchActiveProducts`) against the real catalogue, not a
 * search icon that goes nowhere. Always dynamically rendered (reads
 * `searchParams`); the catalogue is small enough that this costs nothing
 * worth optimizing around.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q ?? '';
  const results = query.trim().length > 0 ? await searchActiveProducts(query) : [];

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.searchResultsHeadingPl}</Heading>

        {query.trim().length === 0 ? (
          <Text muted>{SITE.searchEmptyQueryPl}</Text>
        ) : (
          <>
            <Text muted>
              {SITE.searchResultsForPl} „{query}"
            </Text>
            {results.length === 0 ? (
              <div style={{ marginBlockStart: 16 }}>
                <Text muted>{SITE.searchNoResultsPl}</Text>
              </div>
            ) : (
              <div
                style={{
                  marginBlockStart: 24,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 24,
                }}
              >
                {results.map((product) => (
                  <ProductCard
                    key={product.slug}
                    href={`/produkt/${product.slug}`}
                    namePl={product.namePl}
                    categoryNamePl={product.categoryNamePl}
                    categorySlug={product.categorySlug}
                    imageUrl={product.primaryImageUrl}
                    minPriceGrosze={product.minPriceGrosze}
                    hasPersonalization={product.hasPersonalization}
                    productionDaysMin={product.productionDaysMin}
                    productionDaysMax={product.productionDaysMax}
                    minWidthMm={product.minWidthMm}
                    maxWidthMm={product.maxWidthMm}
                    materials={product.materials}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </Section>
  );
}

export const metadata: Metadata = {
  title: SITE.searchResultsHeadingPl,
  robots: { index: false },
};

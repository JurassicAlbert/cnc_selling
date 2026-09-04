import type { Metadata } from 'next';

import { listActiveCategories } from '@/server/repositories/categories';
import { searchActiveProducts } from '@/server/repositories/products';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type SearchPageProps = {
  /**
   * `q` is the phrase; `k` is the category slug the selector attached to the
   * search field submits (UX-23). Both come from a plain GET form, so both
   * survive being bookmarked and shared - which is also why `k` has to be
   * checked against the live catalogue rather than trusted.
   */
  readonly searchParams: Promise<{ readonly q?: string; readonly k?: string }>;
};

/**
 * A real search results page - diacritic-insensitive matching
 * (`matchesPl`/`searchActiveProducts`) against the real catalogue, not a
 * search icon that goes nowhere. Always dynamically rendered (reads
 * `searchParams`); the catalogue is small enough that this costs nothing
 * worth optimizing around.
 *
 * **2026-09-04, UX-23:** the header's search field now carries a category
 * selector, so this page answers three different requests rather than one -
 * a phrase, a phrase inside a category, and a category on its own. The last
 * is what someone does after picking from the selector and pressing the
 * button, and `searchActiveProducts` lists the category for it rather than
 * returning nothing.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, k } = await searchParams;
  const query = q ?? '';
  const categorySlug = k ?? '';

  const categories = await listActiveCategories();
  const chosenCategory = categories.find((category) => category.slug === categorySlug) ?? null;

  // A named category that is not in the active list is a stale link, and it
  // gets said out loud. Widening the search back to everything would answer
  // a question the customer did not ask, which is the failure UX-21 records
  // one screen along.
  const categoryIsGone = categorySlug.length > 0 && chosenCategory === null;
  const hasRequest = query.trim().length > 0 || categorySlug.length > 0;

  const results = categoryIsGone
    ? []
    : await searchActiveProducts({
        query,
        categorySlug: chosenCategory === null ? undefined : chosenCategory.slug,
      });

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.searchResultsHeadingPl}</Heading>

        {!hasRequest ? (
          <Text muted>{SITE.searchEmptyQueryPl}</Text>
        ) : categoryIsGone ? (
          <Text muted>{SITE.searchCategoryGonePl}</Text>
        ) : (
          <>
            <Text muted>
              {query.trim().length === 0 ? (
                <>
                  {SITE.searchCategoryOnlyPl} „{chosenCategory?.namePl}”
                </>
              ) : (
                <>
                  {SITE.searchResultsForPl} „{query}”
                  {chosenCategory !== null && (
                    <>
                      {' '}
                      {SITE.searchInCategoryPl} „{chosenCategory.namePl}”
                    </>
                  )}
                </>
              )}
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
                    startingPriceGrossGrosze={product.startingPriceGrossGrosze}
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

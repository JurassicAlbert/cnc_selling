import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getActiveCategoryBySlug, listActiveCategories } from '@/server/repositories/categories';
import {
  listActiveProductsByCategorySlug,
  listCategoryFilterMaterials,
  type ProductSort,
} from '@/server/repositories/products';
import { Breadcrumbs } from '@/ui/primitives/Breadcrumbs';
import { CategoryFilterForm } from '@/ui/primitives/CategoryFilterForm';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
import { ICON_PAIRS } from '@/ui/primitives/SectionDecoration';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type CategoryPageProps = {
  readonly params: Promise<{ readonly category: string }>;
  readonly searchParams: Promise<{ readonly material?: string; readonly sort?: string }>;
};

function parseSort(value: string | undefined): ProductSort {
  return value === 'price_asc' || value === 'price_desc' ? value : null;
}

/**
 * Server-rendered from the DB (ARCHITECTURE.md §18) — no client-side fetch
 * for content. The filter sidebar (`CategoryFilterForm`) is a native GET
 * form: submitting it re-navigates with new query params, which this page
 * reads server-side. Zero client JS for filtering — see that component's
 * header comment for why that's a deliberate choice, not an oversight.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: slug } = await params;
  const { material, sort: sortParam } = await searchParams;
  const category = await getActiveCategoryBySlug(slug);
  if (category === null) {
    notFound();
  }

  const selectedMaterialSlug = material !== undefined && material.length > 0 ? material : null;
  const sort = parseSort(sortParam);

  const [products, filterMaterials] = await Promise.all([
    listActiveProductsByCategorySlug(slug, { materialSlug: selectedMaterialSlug, sort }),
    listCategoryFilterMaterials(slug),
  ]);

  return (
    <Section decorative={{ side: 'right', icons: ICON_PAIRS.kategorie }}>
      <Container>
        <Breadcrumbs trail={[{ labelPl: category.namePl, href: `/${category.slug}` }]} />
        <Heading level={1}>{category.namePl}</Heading>
        <Text muted>{category.descPl}</Text>

        <div
          style={{ marginBlockStart: 32, display: 'grid', gap: 32 }}
          className="category-layout"
        >
          {/* grid-template-columns lives here, not inline: an inline style always
              wins the cascade over a stylesheet rule, media query included. */}
          <style>{`
            .category-layout { grid-template-columns: 1fr; }
            @media (min-width: 900px) {
              .category-layout { grid-template-columns: 220px 1fr; }
            }
          `}</style>

          {filterMaterials.length > 0 && (
            <CategoryFilterForm
              actionPath={`/${category.slug}`}
              materials={filterMaterials}
              selectedMaterialSlug={selectedMaterialSlug}
              sort={sort}
            />
          )}

          <div>
            {products.length === 0 ? (
              <Text muted>{SITE.catalogueEmptyCategoryPl}</Text>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 24,
                }}
              >
                {products.map((product) => (
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
          </div>
        </div>
      </Container>
    </Section>
  );
}

export async function generateStaticParams(): Promise<{ category: string }[]> {
  const categories = await listActiveCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getActiveCategoryBySlug(slug);
  if (category === null) {
    return {};
  }
  return {
    title: category.seoTitlePl,
    description: category.seoDescPl,
    alternates: { canonical: `/${category.slug}` },
    openGraph: {
      title: category.seoTitlePl,
      description: category.seoDescPl,
      images: category.imageUrl !== null ? [category.imageUrl] : [],
    },
  };
}

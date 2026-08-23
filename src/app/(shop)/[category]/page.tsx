import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatPln } from '@/domain/money/money';
import { getActiveCategoryBySlug, listActiveCategories } from '@/server/repositories/categories';
import { listActiveProductsByCategorySlug } from '@/server/repositories/products';
import { Breadcrumbs } from '@/ui/primitives/Breadcrumbs';
import { Card } from '@/ui/primitives/Card';
import { Container } from '@/ui/primitives/Container';
import { Grid } from '@/ui/primitives/Grid';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type CategoryPageProps = {
  readonly params: Promise<{ readonly category: string }>;
};

/** Server-rendered from the DB (ARCHITECTURE.md §18) — no client-side fetch for content. */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await getActiveCategoryBySlug(slug);
  if (category === null) {
    notFound();
  }

  const products = await listActiveProductsByCategorySlug(slug);

  return (
    <Section>
      <Container>
        <Breadcrumbs trail={[{ labelPl: category.namePl, href: `/${category.slug}` }]} />
        <Heading level={1}>{category.namePl}</Heading>
        <Text muted>{category.descPl}</Text>

        {products.length === 0 ? (
          <Text muted>{SITE.catalogueEmptyCategoryPl}</Text>
        ) : (
          <Grid>
            {products.map((product) => (
              <Card
                key={product.slug}
                href={`/produkt/${product.slug}`}
                imageUrl={product.primaryImageUrl}
                imageAlt={product.namePl}
              >
                <Heading level={3}>{product.namePl}</Heading>
                <Text muted>{product.shortDescPl}</Text>
                <Text>
                  {SITE.catalogueStartingPricePrefixPl} {formatPln(product.minPriceGrosze)}
                </Text>
              </Card>
            ))}
          </Grid>
        )}
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

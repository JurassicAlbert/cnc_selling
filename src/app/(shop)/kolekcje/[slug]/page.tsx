import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getActiveCollectionBySlug, listActiveCollections, listActiveProductsByCollectionSlug } from '@/server/repositories/collections';
import { Breadcrumbs } from '@/ui/primitives/Breadcrumbs';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { ProductCard } from '@/ui/primitives/ProductCard';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type CollectionDetailPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { slug } = await params;
  const collection = await getActiveCollectionBySlug(slug);
  if (collection === null) {
    notFound();
  }
  const products = await listActiveProductsByCollectionSlug(slug);

  return (
    <Section>
      <Container>
        <Breadcrumbs trail={[{ labelPl: SITE.collectionsHeadingPl, href: '/kolekcje' }, { labelPl: collection.namePl, href: `/kolekcje/${collection.slug}` }]} />
        <div
          style={{
            display: 'inline-block',
            marginBlockEnd: 8,
            font: 'var(--mui-font-caption)',
            color: 'var(--mui-palette-text-secondary)',
            border: '1px solid var(--mui-palette-divider)',
            borderRadius: 999,
            padding: '2px 10px',
          }}
        >
          {SITE.collectionsBadgePl}
        </div>
        <Heading level={1}>{collection.namePl}</Heading>
        <Text muted>{collection.descPl}</Text>

        {products.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.collectionEmptyProductsPl}</Text>
          </div>
        ) : (
          <div
            style={{
              marginBlockStart: 32,
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
      </Container>
    </Section>
  );
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const collections = await listActiveCollections();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: CollectionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getActiveCollectionBySlug(slug);
  if (collection === null) {
    return {};
  }
  return {
    title: collection.seoTitlePl,
    description: collection.seoDescPl,
    alternates: { canonical: `/kolekcje/${collection.slug}` },
    openGraph: {
      title: collection.seoTitlePl,
      description: collection.seoDescPl,
      images: collection.imageUrl !== null ? [collection.imageUrl] : [],
    },
  };
}

import type { Metadata } from 'next';
import Image from 'next/image';
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

        {/*
         * 2026-08-29, owner feedback (paraphrased): the collection photo
         * showed up on the /kolekcje card but never on the collection's own
         * page — a real bug: `getActiveCollectionBySlug` already returned
         * `imageUrl`, it was only ever used in `generateMetadata`'s
         * OpenGraph tags below, never actually rendered on the page a
         * visitor sees. Real hero image now, same width as the page.
         */}
        {collection.imageUrl !== null && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '21 / 9',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              marginBlockEnd: 24,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Image src={collection.imageUrl} alt="" fill sizes="(max-width: 900px) 100vw, 900px" style={{ objectFit: 'cover' }} priority />
          </div>
        )}

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

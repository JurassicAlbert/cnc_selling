import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { listActiveCollections } from '@/server/repositories/collections';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.collectionsSeoTitlePl,
  description: SITE.collectionsSeoDescPl,
  alternates: { canonical: '/kolekcje' },
};

/**
 * P9 phase 4: `ProductCollection` — curated, ready-made groupings of
 * independently-created products. Deliberately distinct from `Category`
 * (every product still belongs to exactly one category regardless of
 * collection membership) and from the unrelated, pattern-grouping
 * `DesignCollection`. Framed honestly in copy as ready-made, not
 * customer-request-driven — matching §14's business-rules distinction.
 */
export default async function CollectionsIndexPage() {
  const collections = await listActiveCollections();

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.collectionsHeadingPl}</Heading>
        <div style={{ marginBlockStart: 16, maxWidth: 720 }}>
          <Text muted>{SITE.collectionsIntroPl}</Text>
        </div>

        {collections.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.collectionsEmptyPl}</Text>
          </div>
        ) : (
          <div
            style={{
              marginBlockStart: 32,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 32,
            }}
          >
            {collections.map((collection) => (
              <Link
                key={collection.slug}
                href={`/kolekcje/${collection.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                {collection.imageUrl !== null && (
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
                      src={collection.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 280px"
                      style={{ objectFit: 'cover' }}
                    />
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
                <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>{collection.namePl}</div>
                <div style={{ marginBlockStart: 8 }}>
                  <Text muted>{collection.descPl}</Text>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

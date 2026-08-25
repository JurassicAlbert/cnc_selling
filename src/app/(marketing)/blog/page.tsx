import type { Metadata } from 'next';
import Link from 'next/link';

import { listPublishedBlogPosts } from '@/server/repositories/blog';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.blogSeoTitlePl,
  description: SITE.blogSeoDescPl,
  alternates: { canonical: '/blog' },
};

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

/**
 * Scaffold, added 2026-08-25 at the owner's explicit request: real
 * infrastructure (schema, repository, this page), zero fabricated posts.
 * `listPublishedBlogPosts()` returns an empty array today — the table has
 * no seeded rows — so the honest empty state below is what every visitor
 * sees until a real post exists (`docs/HANDOVER.md` §9n's follow-up).
 */
export default async function BlogIndexPage() {
  const posts = await listPublishedBlogPosts();

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.blogHeadingPl}</Heading>

        {posts.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.blogEmptyStatePl}</Text>
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
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>
                  {post.titlePl}
                </div>
                <div style={{ marginBlockStart: 4, font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}>
                  {SITE.blogPublishedLabelPl} {dateFormatter.format(post.publishedAt)}
                </div>
                <div style={{ marginBlockStart: 8 }}>
                  <Text muted>{post.shortDescPl}</Text>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

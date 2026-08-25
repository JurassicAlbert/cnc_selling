import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getPublishedBlogPostBySlug, listAllPublishedBlogPostSlugs } from '@/server/repositories/blog';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type BlogPostPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await listAllPublishedBlogPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (post === null) {
    return {};
  }
  return {
    title: post.seoTitlePl,
    description: post.seoDescPl,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.seoTitlePl,
      description: post.seoDescPl,
      images: post.imageUrl !== null ? [post.imageUrl] : [],
    },
  };
}

/** Same honest-404 pattern as categories/products/orders — an unknown or unpublished slug renders identically. */
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (post === null) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <Heading level={1}>{post.titlePl}</Heading>
        <div style={{ marginBlockStart: 8, font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}>
          {SITE.blogPublishedLabelPl} {dateFormatter.format(post.publishedAt)}
        </div>
        {post.imageUrl !== null && (
          <div
            style={{
              position: 'relative',
              marginBlockStart: 24,
              maxWidth: 720,
              aspectRatio: '16 / 9',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Image src={post.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 720px" style={{ objectFit: 'cover' }} priority />
          </div>
        )}
        <div style={{ marginBlockStart: 24, maxWidth: 720, whiteSpace: 'pre-wrap' }}>
          <Text>{post.bodyPl}</Text>
        </div>
      </Container>
    </Section>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getActiveStaticPageBySlug } from '@/server/repositories/static-pages';
import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

type StaticPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateMetadata({ params }: StaticPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getActiveStaticPageBySlug(slug);
  if (page === null) {
    /*
      UX-06. The generic heading, and no boundary of its own: „Nie znaleziono
      takiej strony" is exactly what a missing CMS page is, so a per-route
      one would only repeat the group boundary in a second file.
    */
    return { title: SITE.notFoundHeadingPl };
  }
  return { title: page.seoTitlePl, description: page.seoDescPl, alternates: { canonical: `/strony/${slug}` } };
}

export default async function StaticContentPage({ params }: StaticPageProps) {
  const { slug } = await params;
  const page = await getActiveStaticPageBySlug(slug);
  if (page === null) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <Heading level={1}>{page.titlePl}</Heading>
        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          {page.bodyPl.split('\n').filter((paragraph) => paragraph.trim().length > 0).map((paragraph, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <Text key={index} muted>
              {paragraph}
            </Text>
          ))}
        </div>
      </Container>
    </Section>
  );
}

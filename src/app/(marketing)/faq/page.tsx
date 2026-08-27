import type { Metadata } from 'next';

import { listActiveFaqs } from '@/server/repositories/faq';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { toSafeJsonLd } from '@/ui/seo/json-ld';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.faqSeoTitlePl,
  description: SITE.faqSeoDescPl,
  alternates: { canonical: '/faq' },
};

export default async function FaqPage() {
  const faqs = await listActiveFaqs();

  const jsonLd =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.questionPl,
            acceptedAnswer: { '@type': 'Answer', text: faq.answerPl },
          })),
        }
      : null;

  return (
    <Section>
      <Container>
        {jsonLd !== null && (
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: only way to emit JSON-LD; toSafeJsonLd escapes `<` so it can't break out of the script tag — src/ui/seo/json-ld.ts
            dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }}
          />
        )}
        <Heading level={1}>{SITE.faqHeadingPl}</Heading>

        {faqs.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.faqEmptyStatePl}</Text>
          </div>
        ) : (
          <div style={{ marginBlockStart: 32, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
            {faqs.map((faq) => (
              <details
                key={faq.id}
                style={{
                  border: '1px solid var(--mui-palette-divider)',
                  borderRadius: 'var(--radius-card)',
                  padding: '16px 20px',
                }}
              >
                <summary style={{ font: 'var(--mui-font-h6)', cursor: 'pointer' }}>{faq.questionPl}</summary>
                <div style={{ marginBlockStart: 12 }}>
                  <Text muted>{faq.answerPl}</Text>
                </div>
              </details>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

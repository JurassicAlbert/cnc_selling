import type { Metadata } from 'next';

import { listActiveFaqs } from '@/server/repositories/faq';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { FaqAccordionList } from '@/ui/islands/FaqAccordionList';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { toSafeJsonLd } from '@/ui/seo/json-ld';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.faqSeoTitlePl,
  description: SITE.faqSeoDescPl,
  alternates: { canonical: '/faq' },
};

/**
 * Real MUI `Accordion`, not the raw `<details>/<summary>` this page used
 * before - the owner's own ask ("polished MUI design, preferably an
 * accordion"). `ThemeRegistry` is mounted around just the accordion list,
 * the same "wrap the one real interactive island, not the whole page"
 * precedent the product page's Configurator already established
 * (`ThemeRegistry.tsx`'s own header comment: mounting it at the root
 * shipped the full MUI+Emotion runtime to pages with zero interactive MUI
 * components and measurably hurt mobile LCP). The homepage's own FAQ
 * teaser deliberately keeps the lighter `<details>` version - it's on the
 * highest-traffic, most LCP-sensitive page on the site, and doesn't need
 * a full accordion, just a glance-and-click preview.
 */
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
            // biome-ignore lint/security/noDangerouslySetInnerHtml: only way to emit JSON-LD; toSafeJsonLd escapes `<` so it can't break out of the script tag - src/ui/seo/json-ld.ts
            dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }}
          />
        )}
        <Heading level={1}>{SITE.faqHeadingPl}</Heading>

        {faqs.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.faqEmptyStatePl}</Text>
          </div>
        ) : (
          <div style={{ marginBlockStart: 32, maxWidth: 720 }}>
            <ThemeRegistry>
              <FaqAccordionList faqs={faqs} />
            </ThemeRegistry>
          </div>
        )}
      </Container>
    </Section>
  );
}

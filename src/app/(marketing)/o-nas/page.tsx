import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.aboutSeoTitlePl,
  description: SITE.aboutSeoDescPl,
  alternates: { canonical: '/o-nas' },
};

/**
 * 2026-08-29, owner request - a real "O nas" page for the new navbar
 * structure (Produkty / O nas / FAQ / Kolekcje / Koszyk / Konto). Plain
 * static marketing copy - no MUI needed, matches every other RSC-only
 * marketing page's register (ARCHITECTURE.md §2.1).
 */
export default function AboutPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.aboutHeadingPl}</Heading>
        <div style={{ marginBlockStart: 16, maxWidth: 640 }}>
          <Text>{SITE.aboutIntroPl}</Text>
        </div>

        <div style={{ marginBlockStart: 40, display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 640 }}>
          <div>
            <Heading level={2}>{SITE.aboutCraftHeadingPl}</Heading>
            <div style={{ marginBlockStart: 8 }}>
              <Text muted>{SITE.aboutCraftBodyPl}</Text>
            </div>
          </div>

          <div>
            <Heading level={2}>{SITE.aboutMaterialsHeadingPl}</Heading>
            <div style={{ marginBlockStart: 8 }}>
              <Text muted>{SITE.aboutMaterialsBodyPl}</Text>
            </div>
          </div>

          <div>
            <Heading level={2}>{SITE.aboutPersonalizationHeadingPl}</Heading>
            <div style={{ marginBlockStart: 8 }}>
              <Text muted>{SITE.aboutPersonalizationBodyPl}</Text>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

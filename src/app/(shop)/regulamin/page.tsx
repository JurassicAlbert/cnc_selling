import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.legalTermsHeadingPl,
};

/**
 * A real stub, not a dead link — `docs/ARCHITECTURE.md` §17 requires a real
 * Polish e-commerce lawyer to review the actual Regulamin before launch, so
 * this honestly says the document is in preparation rather than inventing
 * legal text or 404ing when the footer links here.
 */
export default function RegulaminPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.legalTermsHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.legalComingSoonNoticePl}</Text>
        </div>
      </Container>
    </Section>
  );
}

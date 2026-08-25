import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.legalPrivacyHeadingPl,
};

/**
 * See regulamin/page.tsx's comment — same reasoning, same honest
 * "in preparation" stub rather than a dead footer link or invented copy.
 */
export default function PolitykaPrywatnosciPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.legalPrivacyHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.legalComingSoonNoticePl}</Text>
        </div>
      </Container>
    </Section>
  );
}

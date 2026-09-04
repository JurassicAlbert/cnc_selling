import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { PRIVACY_SECTIONS } from '@/content/pl/legal';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { LegalDocument } from '@/ui/primitives/LegalDocument';
import { Section } from '@/ui/primitives/Section';

export const metadata: Metadata = {
  title: SITE.legalPrivacyHeadingPl,
};

/** See `regulamin/page.tsx`'s comment - same reasoning. */
export default function PolitykaPrywatnosciPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.legalPrivacyHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <LegalDocument sections={PRIVACY_SECTIONS} />
        </div>
      </Container>
    </Section>
  );
}

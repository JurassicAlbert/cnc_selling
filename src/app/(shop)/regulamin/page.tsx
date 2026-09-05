import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { REGULAMIN_SECTIONS } from '@/content/pl/legal';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { LegalDocument } from '@/ui/primitives/LegalDocument';
import { Section } from '@/ui/primitives/Section';

export const metadata: Metadata = {
  title: SITE.legalTermsHeadingPl,
};

/**
 * Real, structurally-correct content (P6 Part E) - see `content/pl/legal.ts`'s
 * header for what's real vs. still a marked placeholder (business identity
 * fields only; the legal structure itself is real).
 */
export default function RegulaminPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.legalTermsHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <LegalDocument sections={REGULAMIN_SECTIONS} />
        </div>
      </Container>
    </Section>
  );
}

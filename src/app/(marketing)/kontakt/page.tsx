import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { submitSupportRequest } from '@/server/actions/support-requests';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { SupportRequestForm } from '@/ui/islands/SupportRequestForm';

export const metadata: Metadata = {
  title: SITE.contactSeoTitlePl,
  description: SITE.contactSeoDescPl,
  alternates: { canonical: '/kontakt' },
};

/**
 * P9 phase 8 — the standalone contact form. A real, internal DB-driven
 * `SupportRequest` row a staff member reads and answers through
 * `/panel/kontakt` — no fake external communication integration (§9/§15).
 */
export default async function ContactPage() {
  const session = await getSession();

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.contactHeadingPl}</Heading>
        <div style={{ marginBlockStart: 16, marginBlockEnd: 32, maxWidth: 480 }}>
          <Text muted>{SITE.contactIntroPl}</Text>
        </div>

        <ThemeRegistry>
          <SupportRequestForm action={submitSupportRequest} defaultEmail={session?.email} />
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

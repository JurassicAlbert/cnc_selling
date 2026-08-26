import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { LoginForm } from '@/ui/islands/auth/LoginForm';
import { OtpLoginForm } from '@/ui/islands/auth/OtpLoginForm';

export const metadata: Metadata = {
  title: SITE.authLoginHeadingPl,
};

export default async function LoginPage() {
  const session = await getSession();
  if (session !== null) {
    redirect('/moje-konto');
  }

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.authLoginHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <LoginForm />
        </div>
        <div style={{ marginBlockStart: 32, paddingBlockStart: 24, borderTop: '1px solid var(--mui-palette-divider)' }}>
          <p style={{ font: 'var(--mui-font-body2)', marginBlockEnd: 16 }}>{SITE.authOrDividerPl}</p>
          <OtpLoginForm />
        </div>
      </Container>
    </Section>
  );
}

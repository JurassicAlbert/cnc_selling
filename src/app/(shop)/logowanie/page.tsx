import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
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
        <ThemeRegistry>
          <div style={{ marginBlockStart: 24 }}>
            <LoginForm />
          </div>
          <div style={{ marginBlockStart: 32, paddingBlockStart: 24, borderTop: '1px solid var(--mui-palette-divider)' }}>
            <div style={{ marginBlockEnd: 16 }}>
              <Text muted>{SITE.authOrDividerPl}</Text>
            </div>
            <OtpLoginForm />
          </div>
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { RegisterForm } from '@/ui/islands/auth/RegisterForm';

export const metadata: Metadata = {
  title: SITE.authRegisterHeadingPl,
};

export default async function RegisterPage() {
  const session = await getSession();
  if (session !== null) {
    redirect('/moje-konto');
  }

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.authRegisterHeadingPl}</Heading>
        <ThemeRegistry>
          <div style={{ marginBlockStart: 24 }}>
            <RegisterForm />
          </div>
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

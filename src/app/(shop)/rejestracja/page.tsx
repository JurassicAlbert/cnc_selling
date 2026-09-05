import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { BotanicalEngraving } from '@/ui/primitives/engravings';
import { Container } from '@/ui/primitives/Container';
import { ICON_PAIRS } from '@/ui/primitives/SectionDecoration';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { AuthPanel } from '@/ui/islands/auth/AuthPanel';
import { RegisterForm } from '@/ui/islands/auth/RegisterForm';

export const metadata: Metadata = {
  title: SITE.authRegisterHeadingPl,
};

/** 2026-08-28 redesign - same `AuthPanel`/decorative treatment as `/logowanie`, see that page's own header comment. */
export default async function RegisterPage() {
  const session = await getSession();
  if (session !== null) {
    redirect('/moje-konto');
  }

  return (
    <Section decorative={{ side: 'left', icons: ICON_PAIRS.heroLeft, engraving: BotanicalEngraving }}>
      <Container>
        <ThemeRegistry>
          <AuthPanel heading={SITE.authRegisterHeadingPl}>
            <RegisterForm />
          </AuthPanel>
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

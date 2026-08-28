import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { BotanicalEngraving } from '@/ui/primitives/engravings';
import { Container } from '@/ui/primitives/Container';
import { ICON_PAIRS } from '@/ui/primitives/SectionDecoration';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { AuthPanel, AuthTabs } from '@/ui/islands/auth/AuthPanel';
import { LoginForm } from '@/ui/islands/auth/LoginForm';
import { OtpLoginForm } from '@/ui/islands/auth/OtpLoginForm';

export const metadata: Metadata = {
  title: SITE.authLoginHeadingPl,
};

/**
 * 2026-08-28 redesign, owner feedback ("bare vanilla html/css look") — the
 * decorative hex/engraving accent (`Section`'s own `decorative` prop, the
 * same system the homepage/category pages already use) plus a real `Paper`
 * panel (`AuthPanel`) and `Tabs` (`AuthTabs`) replace what used to be a
 * bare heading and two stacked forms. `BotanicalEngraving` was the one
 * illustration still unused anywhere on the site; `ICON_PAIRS.heroLeft` is
 * reused (already the site's own precedent for one repeat being fine — see
 * that constant's own comment) rather than inventing a ninth icon.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session !== null) {
    redirect('/moje-konto');
  }

  return (
    <Section decorative={{ side: 'right', icons: ICON_PAIRS.heroLeft, engraving: BotanicalEngraving }}>
      <Container>
        <ThemeRegistry>
          <AuthPanel heading={SITE.authLoginHeadingPl}>
            <AuthTabs
              passwordTabLabel={SITE.authTabPasswordPl}
              otpTabLabel={SITE.authTabOtpPl}
              passwordPanel={<LoginForm />}
              otpPanel={<OtpLoginForm />}
            />
          </AuthPanel>
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

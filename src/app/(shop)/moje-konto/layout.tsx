import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { logout } from '@/server/actions/auth';
import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';

/** Session gate for every `/moje-konto/*` route — redirects to `/logowanie` once, here, rather than in each page. */
export default async function AccountLayout({ children }: { readonly children: ReactNode }) {
  const session = await getSession();
  if (session === null) {
    redirect('/logowanie');
  }

  return (
    <Section>
      <Container>
        <nav style={{ display: 'flex', gap: 24, alignItems: 'center', marginBlockEnd: 24, flexWrap: 'wrap' }}>
          <Link href="/moje-konto/zamowienia" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.accountNavOrdersPl}
          </Link>
          <Link href="/moje-konto/projekty" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.accountNavConfigurationsPl}
          </Link>
          <Link href="/moje-konto/wzory" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.accountNavDesignsPl}
          </Link>
          <form action={logout} style={{ marginInlineStart: 'auto' }}>
            <button
              type="submit"
              style={{
                font: 'var(--mui-font-body2)',
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {SITE.headerLogoutPl}
            </button>
          </form>
        </nav>
        {children}
      </Container>
    </Section>
  );
}

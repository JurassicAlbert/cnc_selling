import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth/session';
import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { AccountNav } from '@/ui/islands/AccountNav';

/** Session gate for every `/moje-konto/*` route - redirects to `/logowanie` once, here, rather than in each page. */
export default async function AccountLayout({ children }: { readonly children: ReactNode }) {
  const session = await getSession();
  if (session === null) {
    redirect('/logowanie');
  }

  return (
    <Section>
      <Container>
        <AccountNav />
        {children}
      </Container>
    </Section>
  );
}

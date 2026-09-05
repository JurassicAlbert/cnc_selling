import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth/session';
import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { AccountNav } from '@/ui/islands/AccountNav';

/*
  BUG-17. On the layout rather than on each page beneath it: `metadata` here
  applies to every route in the group, so a page added later is covered
  without anyone remembering to. That is the whole argument for putting it
  here - the nine account pages that exist today are not the risk, the tenth
  one is.

  `robots.txt` asks crawlers not to fetch these. This is the half that keeps
  a URL out of an index it has already reached some other way.
*/
export const metadata: Metadata = {
  robots: { index: false },
};

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

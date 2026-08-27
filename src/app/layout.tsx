import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { listActiveCategories } from '@/server/repositories/categories';
import { getSession } from '@/server/auth/session';
import { readConsentChoice } from '@/server/session/consent';
import { bodyFont, displayFont } from '@/ui/theme/fonts';
import { CookieConsentBanner } from '@/ui/islands/consent/CookieConsentBanner';
import { Footer } from '@/ui/primitives/Footer';
import { SearchBar } from '@/ui/primitives/SearchBar';
import { SiteHeader } from '@/ui/primitives/SiteHeader';
import './theme-vars.css';

// Falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL once a real
// domain exists, so absolute OG/canonical URLs resolve correctly everywhere.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'RYT',
};

/**
 * No `ThemeRegistry` here on purpose — see `theme-vars.css`'s header
 * comment. Every page today is pure RSC content; the theme tokens it needs
 * come from a plain stylesheet, not a client MUI provider wrapping the
 * whole app.
 *
 * `listActiveCategories()` is fetched once here and passed to both
 * `SiteHeader` and `Footer` (added 2026-08-25), rather than each querying
 * it independently — the same category list, one DB round trip per request.
 * `getSession()` (P6) is fetched the same way and passed only to
 * `SiteHeader`, which stays a plain RSC — no client-side auth check needed
 * just to show "Zaloguj się" vs. "Moje konto". `readConsentChoice()` (P6
 * Part E) gates the one client island in this tree: the consent banner only
 * renders while no choice has been made yet.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [categories, session, consentChoice] = await Promise.all([
    listActiveCategories(),
    getSession(),
    readConsentChoice(),
  ]);

  return (
    <html lang="pl" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <SiteHeader categories={categories} session={session === null ? null : { name: session.name }} />
        <SearchBar />
        <main>{children}</main>
        <Footer categories={categories} />
        {consentChoice === null && <CookieConsentBanner />}
      </body>
    </html>
  );
}

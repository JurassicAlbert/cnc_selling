import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { bodyFont, displayFont } from '@/ui/theme/fonts';
import { SiteHeader } from '@/ui/primitives/SiteHeader';
import './theme-vars.css';

// Falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL once a real
// domain exists, so absolute OG/canonical URLs resolve correctly everywhere.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'CNC Selling',
};

/**
 * No `ThemeRegistry` here on purpose — see `theme-vars.css`'s header
 * comment. Every page today is pure RSC content; the theme tokens it needs
 * come from a plain stylesheet, not a client MUI provider wrapping the
 * whole app.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}

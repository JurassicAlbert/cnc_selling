import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { bodyFont, displayFont } from '@/ui/theme/fonts';
import './theme-vars.css';

// Falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL once a real
// domain exists, so absolute OG/canonical URLs resolve correctly everywhere.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'RYT',
};

/**
 * The TRUE Next.js root — applies to every route in the app, `/panel/*`
 * included. Deliberately minimal: just `<html>`/`<body>` and the fonts.
 * `SiteHeader`/`SearchBar`/`Footer`/the consent banner used to live here,
 * which meant every admin page was always wrapped in the customer
 * storefront's own nav and footer on top of its own sidebar — a real bug,
 * fixed 2026-08-28 (owner feedback) by moving all of that into
 * `StorefrontChrome`, rendered only by `(marketing)/layout.tsx` and
 * `(shop)/layout.tsx`. `(admin)/panel/layout.tsx` renders directly under
 * this root now and nothing else — no double chrome.
 *
 * No `ThemeRegistry` here on purpose — see `theme-vars.css`'s header
 * comment. Every page under the customer-facing groups is pure RSC
 * content; the theme tokens they need come from a plain stylesheet, not a
 * client MUI provider wrapping the whole app.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}

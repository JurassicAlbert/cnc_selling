import type { ReactNode } from 'react';

import { listActiveCategories } from '@/server/repositories/categories';
import { getSession } from '@/server/auth/session';
import { readConsentChoice } from '@/server/session/consent';
import { CookieConsentBanner } from '@/ui/islands/consent/CookieConsentBanner';
import { Footer } from '@/ui/primitives/Footer';
import { SearchBar } from '@/ui/primitives/SearchBar';
import { SiteHeader } from '@/ui/primitives/SiteHeader';

/**
 * 2026-08-28, owner feedback: "panel admina powinien być na osobnej
 * stronie ze swoją nawigacją... a nie jako ramka wewnątrz naszej strony"
 * (the admin panel should be its own page with its own nav, not a frame
 * inside our site) — a real, confirmed bug: `src/app/layout.tsx` is the
 * true Next.js root layout, applying to literally every route including
 * `/panel/*`, so every admin page was always wrapped in the customer
 * `SiteHeader` (category nav, cart, "Moje konto") and `Footer` on top of
 * the admin shell's own sidebar/topbar (`(admin)/panel/layout.tsx`) —
 * double chrome, and the "separate experience" `panel/layout.tsx`'s own
 * header comment already claimed was never actually true.
 *
 * This component holds everything that moved OUT of the true root layout.
 * `(marketing)/layout.tsx` and `(shop)/layout.tsx` both render it —
 * `(admin)` does not, and now genuinely never sees the storefront chrome.
 * Extracted rather than given its own dedicated root layout because Next.js
 * route groups are siblings here, not nested under one shared parent
 * segment (renaming that would mean moving every file under both
 * directories) — two thin layout files importing one shared component is
 * the lower-risk, equally-correct way to the same result.
 */
export async function StorefrontChrome({ children }: { readonly children: ReactNode }) {
  const [categories, session, consentChoice] = await Promise.all([
    listActiveCategories(),
    getSession(),
    readConsentChoice(),
  ]);

  return (
    <>
      <SiteHeader categories={categories} session={session === null ? null : { name: session.name }} />
      <SearchBar />
      <main>{children}</main>
      <Footer categories={categories} />
      {consentChoice === null && <CookieConsentBanner />}
    </>
  );
}

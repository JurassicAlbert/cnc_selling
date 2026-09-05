import type { ReactNode } from 'react';

import { SITE } from '@/content/pl/site';
import { listActiveCategories } from '@/server/repositories/categories';
import { listActiveCollections } from '@/server/repositories/collections';
import { getCartSummaryForRequest } from '@/server/repositories/cart';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { readConsentChoice } from '@/server/session/consent';
import { CookieConsentBanner } from '@/ui/islands/consent/CookieConsentBanner';
import { Footer } from '@/ui/primitives/Footer';
import { SearchBar } from '@/ui/primitives/SearchBar';
import { SiteHeader } from '@/ui/primitives/SiteHeader';
import { SiteTopBar } from '@/ui/primitives/SiteTopBar';

/**
 * 2026-08-28, owner feedback: "panel admina powinien być na osobnej
 * stronie ze swoją nawigacją... a nie jako ramka wewnątrz naszej strony"
 * (the admin panel should be its own page with its own nav, not a frame
 * inside our site) - a real, confirmed bug: `src/app/layout.tsx` is the
 * true Next.js root layout, applying to literally every route including
 * `/panel/*`, so every admin page was always wrapped in the customer
 * `SiteHeader` (category nav, cart, "Moje konto") and `Footer` on top of
 * the admin shell's own sidebar/topbar (`(admin)/panel/layout.tsx`) -
 * double chrome, and the "separate experience" `panel/layout.tsx`'s own
 * header comment already claimed was never actually true.
 *
 * This component holds everything that moved OUT of the true root layout.
 * `(marketing)/layout.tsx` and `(shop)/layout.tsx` both render it -
 * `(admin)` does not, and now genuinely never sees the storefront chrome.
 * Extracted rather than given its own dedicated root layout because Next.js
 * route groups are siblings here, not nested under one shared parent
 * segment (renaming that would mean moving every file under both
 * directories) - two thin layout files importing one shared component is
 * the lower-risk, equally-correct way to the same result.
 */
export async function StorefrontChrome({ children }: { readonly children: ReactNode }) {
  const [categories, collections, session, consentChoice, sessionToken, storeSettings] = await Promise.all([
    listActiveCategories(),
    listActiveCollections(),
    getSession(),
    readConsentChoice(),
    readGuestSessionToken(),
    // The social profiles for the strip above the navigation. Read here with
    // the rest of the chrome's data rather than inside `SiteTopBar`, so it
    // stays one round trip for the whole header.
    getStoreSettings(),
  ]);
  // Cart summary depends on `session`/`sessionToken` above, so it's a
  // second read rather than folded into the first `Promise.all` - both
  // still run before any JSX, same "read everything, then render" shape.
  const cartSummary = await getCartSummaryForRequest({ userId: session?.userId ?? null, sessionToken });

  return (
    <>
      {/* UX-23's three header bands, in the reference layout's order: the
          slim strip, the navigation, then search across the full width. */}
      <SiteTopBar
        social={{
          facebookUrl: storeSettings.facebookUrl,
          instagramUrl: storeSettings.instagramUrl,
          tiktokUrl: storeSettings.tiktokUrl,
          youtubeUrl: storeSettings.youtubeUrl,
        }}
      />
      {/*
        BUG-28. The first thing a keyboard reaches on every storefront page.
        Before the header, because a skip link that comes after the thing it
        skips is decoration.

        `#tresc` rather than a `main` selector: the target has to be a real id
        for the fragment navigation to move focus, and `<main>` alone is not
        addressable. `tabIndex={-1}` on the target so the browser will focus
        it - without it the page scrolls and focus stays behind in the header,
        which is the quiet way skip links fail.
      */}
      <a href="#tresc" className="skip-link">
        {SITE.skipToContentPl}
      </a>
      <SiteHeader
        categories={categories}
        collections={collections}
        cartSummary={cartSummary}
        session={session === null ? null : { name: session.name }}
      />
      <SearchBar categories={categories} />
      <main id="tresc" tabIndex={-1}>
        {children}
      </main>
      <Footer categories={categories} />
      {consentChoice === null && <CookieConsentBanner />}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { findCartForRequest } from '@/server/repositories/cart';
import { CartContents } from '@/ui/islands/cart/CartContents';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: SITE.cartHeadingPl,
};

/**
 * A Server Component throughout - no client JS at all. All rendering
 * (including every MUI component) lives in `CartContents`
 * (`ui/islands/cart/CartContents.tsx`) - `@mui/material` is lint-forbidden
 * directly inside `(shop)` Server Components (`ARCHITECTURE.md` §2.1,
 * `biome.json`'s own override), same "put the interactive part in
 * `src/ui/islands` and render it as a child" rule the product page's
 * Configurator already follows. This page's own job is just: read the
 * cart, mount `ThemeRegistry` around the real UI (same "mount where
 * warranted" precedent checkout already set - `ThemeRegistry`'s own header
 * comment names cart as one of the three intended islands), or show the
 * plain-text empty state when there's nothing to show MUI for at all.
 *
 * `readGuestSessionToken()` only ever READS the cookie - this page never
 * mints one. A first-time visitor with no cart yet, and nothing in it,
 * just sees the empty state; the cookie only gets created on the first
 * real `addToCart` (a Server Action, where writing is allowed).
 */
export default async function CartPage() {
  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  const cart = await findCartForRequest({ userId: session?.userId ?? null, sessionToken });

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.cartHeadingPl}</Heading>

        {cart.items.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.cartEmptyPl}</Text>
            <div style={{ marginBlockStart: 16 }}>
              <Link href="/">{SITE.cartContinueShoppingPl}</Link>
            </div>
          </div>
        ) : (
          <ThemeRegistry>
            <CartContents cart={cart} />
          </ThemeRegistry>
        )}
      </Container>
    </Section>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { findCartForRequest } from '@/server/repositories/cart';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { resolveDeliveryMethodsForCart } from '@/server/repositories/delivery-methods';
import { listActivePaymentMethods } from '@/server/repositories/payment-methods';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { CheckoutForm } from '@/ui/islands/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: SITE.checkoutHeadingPl,
};

/**
 * A Server Component shell around one client island — the form itself
 * needs `useActionState` for inline validation feedback, but the cart read
 * needs no interactivity at all.
 *
 * 2026-08-29 rewrite, owner feedback: "Formularz zamówienia również ma
 * bardzo biedne UI/UX" + real weight-based shipping pricing. Delivery
 * methods are no longer a flat, cart-independent list — `resolveDeliveryMethodsForCart`
 * (`server/repositories/delivery-methods.ts`) evaluates each one against
 * THIS cart's real weight/dimensions, so it needs the cart resolved first,
 * not fetched in parallel with it. The item list itself moved into
 * `CheckoutForm`'s own real two-column MUI layout (a sticky order-summary
 * panel) — this page no longer hand-rolls a plain-text item list; the
 * `@mui/material`-forbidden-in-`(shop)`-Server-Components rule
 * (`ARCHITECTURE.md` §2.1) means all of that real UI has to live in the
 * client island anyway.
 */
export default async function CheckoutPage() {
  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  const cart = await findCartForRequest({ userId: session?.userId ?? null, sessionToken });

  if (cart.items.length === 0) {
    redirect('/koszyk');
  }

  const [deliveryMethods, paymentMethods] = await Promise.all([
    resolveDeliveryMethodsForCart(cart),
    listActivePaymentMethods(),
  ]);

  void recordAnalyticsEvent({ name: 'checkout_started', sessionToken, userId: session?.userId ?? null });

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.checkoutHeadingPl}</Heading>

        <div style={{ marginBlockStart: 32 }}>
          <ThemeRegistry>
            <CheckoutForm cart={cart} deliveryMethods={deliveryMethods} paymentMethods={paymentMethods} />
          </ThemeRegistry>
        </div>
      </Container>
    </Section>
  );
}

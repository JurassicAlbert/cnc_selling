import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { findCartForRequest } from '@/server/repositories/cart';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { listActiveDeliveryMethods } from '@/server/repositories/delivery-methods';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { CheckoutForm } from '@/ui/islands/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: SITE.checkoutHeadingPl,
};

/**
 * A Server Component shell around one client island — the form itself
 * needs `useActionState` for inline validation feedback, but the cart read
 * needs no interactivity at all. P9 phase 5: delivery cost is no longer a
 * single flat rate — it depends on the method the customer picks inside
 * `CheckoutForm`, so the running total (subtotal + shipping) now lives
 * there too, not split across a static summary here and a live one below.
 * `ThemeRegistry` mounted here (not at the root — see that file's own
 * comment on measured mobile-LCP cost) around just this real interactive
 * island, same precedent the product page's Configurator already set.
 */
export default async function CheckoutPage() {
  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  const [cart, deliveryMethods] = await Promise.all([
    findCartForRequest({ userId: session?.userId ?? null, sessionToken }),
    listActiveDeliveryMethods(),
  ]);

  if (cart.items.length === 0) {
    redirect('/koszyk');
  }

  void recordAnalyticsEvent({ name: 'checkout_started', sessionToken, userId: session?.userId ?? null });

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.checkoutHeadingPl}</Heading>

        <div style={{ marginBlockStart: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cart.items.map((item) => (
            <div key={item.cartItemId} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text muted>
                {item.productNamePl} × {item.quantity}
              </Text>
              <Text muted>
                {item.priceGrossGrosze !== null ? formatPln(item.priceGrossGrosze * item.quantity) : null}
              </Text>
            </div>
          ))}
        </div>

        <div style={{ marginBlockStart: 32 }}>
          <ThemeRegistry>
            <CheckoutForm deliveryMethods={deliveryMethods} subtotalGrossGrosze={cart.subtotalGrossGrosze} />
          </ThemeRegistry>
        </div>
      </Container>
    </Section>
  );
}

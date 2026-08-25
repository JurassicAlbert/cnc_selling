import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { findCartForRequest } from '@/server/repositories/cart';
import { SHIPPING_FLAT_GROSZE } from '@/server/orders/create-order';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { CheckoutForm } from '@/ui/islands/checkout/CheckoutForm';

export const metadata: Metadata = {
  title: SITE.checkoutHeadingPl,
};

/**
 * A Server Component shell around one client island — the form itself
 * needs `useActionState` for inline validation feedback, but the cart read
 * and the order-summary render need no interactivity at all.
 */
export default async function CheckoutPage() {
  const sessionToken = await readGuestSessionToken();
  const cart = await findCartForRequest({ userId: null, sessionToken });

  if (cart.items.length === 0) {
    redirect('/koszyk');
  }

  const totalGrossGrosze = cart.subtotalGrossGrosze + SHIPPING_FLAT_GROSZE;

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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text muted>{SITE.checkoutShippingLabelPl}</Text>
            <Text muted>{formatPln(SHIPPING_FLAT_GROSZE)}</Text>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: 'var(--mui-font-h5)',
              paddingBlockStart: 8,
              borderTop: '1px solid var(--mui-palette-divider)',
            }}
          >
            <span>{SITE.orderTotalLabelPl}</span>
            <span>{formatPln(totalGrossGrosze)}</span>
          </div>
        </div>

        <div style={{ marginBlockStart: 32 }}>
          <CheckoutForm />
        </div>
      </Container>
    </Section>
  );
}

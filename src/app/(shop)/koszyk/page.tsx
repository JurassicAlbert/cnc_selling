import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { SITE } from '@/content/pl/site';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { findCartForRequest } from '@/server/repositories/cart';
import type { CartItemView } from '@/server/repositories/cart';
import { duplicateCartItem, removeCartItem, updateCartItemQuantity } from '@/server/actions/cart';
import { writeSelectionsToSearch } from '@/ui/islands/configurator/selections-url';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.cartHeadingPl,
};

/**
 * A Server Component throughout — no client JS at all. Quantity/remove/
 * duplicate are each a tiny `<form action={...}>` bound to the matching
 * Server Action with `.bind()`, the same zero-JS pattern
 * `CategoryFilterForm` already established for the category pages.
 *
 * `readGuestSessionToken()` only ever READS the cookie — this page never
 * mints one. A first-time visitor with no cart yet, and nothing in it,
 * just sees the empty state; the cookie only gets created on the first
 * real `addToCart` (a Server Action, where writing is allowed).
 */
export default async function CartPage() {
  const sessionToken = await readGuestSessionToken();
  const cart = await findCartForRequest({ userId: null, sessionToken });

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
          <div style={{ marginBlockStart: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {cart.items.map((item) => (
              <CartRow key={item.cartItemId} item={item} />
            ))}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBlockStart: 24,
                borderTop: '1px solid var(--mui-palette-divider)',
              }}
            >
              <div style={{ font: 'var(--mui-font-h5)' }}>
                {SITE.cartSubtotalLabelPl}: {formatPln(cart.subtotalGrossGrosze)}
              </div>
              <Link
                href="/koszyk/zamowienie"
                style={{
                  font: 'var(--mui-font-button)',
                  padding: '12px 24px',
                  background: 'var(--mui-palette-primary-main)',
                  color: 'var(--mui-palette-background-paper)',
                  textDecoration: 'none',
                  borderRadius: 2,
                }}
              >
                {SITE.cartCheckoutCtaPl}
              </Link>
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}

function CartRow({ item }: { readonly item: CartItemView }) {
  const editHref = `/produkt/${item.productSlug}?${writeSelectionsToSearch(item.selections)}&edit=${item.configurationId}`;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        gap: 16,
        paddingBlockEnd: 24,
        borderBottom: '1px solid var(--mui-palette-divider)',
      }}
    >
      <div style={{ position: 'relative', width: 96, height: 96, borderRadius: 2, overflow: 'hidden' }}>
        {item.imageUrl !== null && <Image src={item.imageUrl} alt="" fill style={{ objectFit: 'cover' }} />}
      </div>

      <div>
        <div style={{ font: 'var(--mui-font-subtitle1)' }}>{item.productNamePl}</div>
        <Text muted>
          {[item.materialNamePl, item.designNamePl, item.finishNamePl, item.fontNamePl]
            .filter((value): value is string => value !== null)
            .join(' · ')}
        </Text>
        {item.widthMm !== null && item.heightMm !== null && (
          <Text muted>
            {SITE.catalogueDimensionsLabelPl}: {formatMmAsCentimetres(item.widthMm)}×
            {formatMmAsCentimetres(item.heightMm)} cm
          </Text>
        )}
        {item.personalizationText !== null && item.personalizationText.trim().length > 0 && (
          <Text muted>„{item.personalizationText}"</Text>
        )}
        {!item.isComplete && <Text muted>{SITE.cartIncompleteNoticePl}</Text>}

        <div style={{ display: 'flex', gap: 16, marginBlockStart: 8, alignItems: 'center' }}>
          <Link href={editHref} style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.cartEditPl}
          </Link>

          <form action={updateCartItemQuantity.bind(null, item.cartItemId)} style={{ display: 'flex', gap: 8 }}>
            <label>
              {SITE.cartQuantityLabelPl}{' '}
              <input
                type="number"
                name="quantity"
                min={1}
                defaultValue={item.quantity}
                style={{ width: 56 }}
              />
            </label>
            <button type="submit">{SITE.cartUpdateQuantityPl}</button>
          </form>

          <form action={duplicateCartItem.bind(null, item.cartItemId)}>
            <button type="submit">{SITE.cartDuplicatePl}</button>
          </form>

          <form action={removeCartItem.bind(null, item.cartItemId)}>
            <button type="submit">{SITE.cartRemovePl}</button>
          </form>
        </div>
      </div>

      <div style={{ font: 'var(--mui-font-subtitle1)', textAlign: 'right' }}>
        {item.priceGrossGrosze !== null ? formatPln(item.priceGrossGrosze * item.quantity) : null}
      </div>
    </div>
  );
}

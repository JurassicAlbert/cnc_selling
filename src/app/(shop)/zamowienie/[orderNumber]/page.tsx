import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { COPY } from '@/content/pl/messages';
import { findOrderForConfirmation } from '@/server/repositories/orders';
import { findReviewStatusForOrder } from '@/server/repositories/reviews';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { submitGuestReview } from '@/server/actions/reviews';
import { submitOrderSupportRequest } from '@/server/actions/support-requests';
import { CheckoutSteps } from '@/ui/primitives/CheckoutSteps';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { OrderShipmentInfo } from '@/ui/primitives/OrderShipmentInfo';
import { OrderStatusBanner } from '@/ui/primitives/OrderStatusBanner';
import { OrderSummary } from '@/ui/primitives/OrderSummary';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { ReviewForm } from '@/ui/islands/ReviewForm';
import { SupportRequestForm } from '@/ui/islands/SupportRequestForm';

type OrderConfirmationPageProps = {
  readonly params: Promise<{ readonly orderNumber: string }>;
  readonly searchParams: Promise<{ readonly token?: string }>;
};

export const metadata: Metadata = {
  title: SITE.orderConfirmationHeadingPl,
  /*
    BUG-17. `robots.txt` asks crawlers not to fetch this; that alone does not
    keep it out of an index, because a disallowed URL something links to can
    still be listed without a snippet. This is the half that removes it.
  */
  robots: { index: false },
};

/**
 * `params.orderNumber` arrives already URL-decoded by Next.js - the real
 * slashes in "2026/08/0042" survive the round trip through the redirect
 * that encoded them as one path segment.
 *
 * A wrong or missing `?token=` renders the exact same "not found" state as
 * a genuinely nonexistent order number - §16.1's "404, not 403" rule,
 * applied here so an order's existence is never probeable by guessing
 * tokens against a real order number.
 */
export default async function OrderConfirmationPage({ params, searchParams }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  const { token } = await searchParams;
  if (token === undefined) {
    notFound();
  }

  // Defensive, not redundant: whether Next.js has already decoded the
  // `%2F` in a dynamic segment back to a real `/` has genuinely varied
  // across versions, and decoding an already-decoded string (no `%`
  // sequences left) is a safe no-op either way.
  const order = await findOrderForConfirmation(decodeURIComponent(orderNumber), token);
  if (order === null) {
    notFound();
  }

  // `getStoreSettings()` could technically start before the order lookup -
  // it depends on nothing - but deliberately doesn't. `notFound()` above
  // throws, so a promise started earlier and never awaited becomes an
  // unhandled rejection that can take the process down. Two indexed row
  // reads are not worth that: this is the "don't optimise blindly" case,
  // not an oversight (2026-08-30 audit).
  const [reviewStatus, storeSettings] = await Promise.all([
    order.status === 'COMPLETED' ? findReviewStatusForOrder(order.orderNumber) : Promise.resolve(null),
    getStoreSettings(),
  ]);

  return (
    <>
      {/* The last step of the rail, so a customer who has just paid can see
          the flow finished rather than only its middle. Nothing on it is a
          link from here: the order consumed the cart, so "back to the cart"
          leads to an empty one, and "back to the order form" would invite a
          second order for one purchase. */}
      <CheckoutSteps current="CONFIRMATION" />

      <Section>
        <Container>
          <Heading level={1}>{SITE.orderConfirmationHeadingPl}</Heading>

        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text>
            {SITE.orderNumberLabelPl}: {order.orderNumber}
          </Text>
        </div>

        {/*
         * 2026-08-29, owner feedback: the status banner/order summary/
         * shipment info were still raw HTML ("Dymki z informacjami to
         * dalej typowy vanilla/raw html/css") - all real MUI now, so they
         * move inside the same `ThemeRegistry` the review/support forms
         * already needed, instead of sitting outside it as plain HTML.
         */}
        <div style={{ marginBlockStart: 24 }}>
          <ThemeRegistry>
            <OrderStatusBanner status={order.status} />
            <div style={{ marginBlockStart: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <OrderSummary order={order} bankDetails={storeSettings} />
              <OrderShipmentInfo shipment={order.shipment} />
            </div>

            <div style={{ marginBlockStart: 24 }}>
              <Text muted>{SITE.orderEmailFollowUpNoticePl}</Text>
              <Text muted>{COPY.orderReceived}</Text>
            </div>

            {order.status === 'COMPLETED' &&
              (reviewStatus !== null ? (
                <Text muted>{SITE.reviewAlreadySubmittedPl}</Text>
              ) : (
                <ReviewForm action={submitGuestReview.bind(null, order.orderNumber, token)} />
              ))}

            <div style={{ marginBlockStart: 32 }}>
              <SupportRequestForm
                action={submitOrderSupportRequest.bind(null, order.orderNumber, token)}
                heading={SITE.contactOrderContextHeadingPl}
                intro={SITE.contactOrderContextIntroPl}
                defaultEmail={order.email}
              />
            </div>
          </ThemeRegistry>
        </div>
        </Container>
      </Section>
    </>
  );
}

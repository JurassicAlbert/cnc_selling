import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { COPY } from '@/content/pl/messages';
import { findOrderForConfirmation } from '@/server/repositories/orders';
import { findReviewStatusForOrder } from '@/server/repositories/reviews';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { submitGuestReview } from '@/server/actions/reviews';
import { submitOrderSupportRequest } from '@/server/actions/support-requests';
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
};

/**
 * `params.orderNumber` arrives already URL-decoded by Next.js — the real
 * slashes in "2026/08/0042" survive the round trip through the redirect
 * that encoded them as one path segment.
 *
 * A wrong or missing `?token=` renders the exact same "not found" state as
 * a genuinely nonexistent order number — §16.1's "404, not 403" rule,
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

  const [reviewStatus, storeSettings] = await Promise.all([
    order.status === 'COMPLETED' ? findReviewStatusForOrder(order.orderNumber) : Promise.resolve(null),
    getStoreSettings(),
  ]);

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.orderConfirmationHeadingPl}</Heading>

        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text>
            {SITE.orderNumberLabelPl}: {order.orderNumber}
          </Text>
        </div>

        <OrderStatusBanner status={order.status} />
        <OrderSummary order={order} bankDetails={storeSettings} />
        <OrderShipmentInfo shipment={order.shipment} />

        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.orderEmailFollowUpNoticePl}</Text>
          <Text muted>{COPY.orderReceived}</Text>
        </div>

        <ThemeRegistry>
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
      </Container>
    </Section>
  );
}

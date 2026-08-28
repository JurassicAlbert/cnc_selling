import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { findOrderForUser } from '@/server/repositories/orders';
import { findReviewStatusForOrder } from '@/server/repositories/reviews';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { submitAccountReview } from '@/server/actions/reviews';
import { submitOrderSupportRequest } from '@/server/actions/support-requests';
import { Heading } from '@/ui/primitives/Heading';
import { OrderShipmentInfo } from '@/ui/primitives/OrderShipmentInfo';
import { OrderSummary } from '@/ui/primitives/OrderSummary';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { ReviewForm } from '@/ui/islands/ReviewForm';
import { SupportRequestForm } from '@/ui/islands/SupportRequestForm';

type AccountOrderDetailPageProps = {
  readonly params: Promise<{ readonly orderNumber: string }>;
};

export const metadata: Metadata = {
  title: SITE.orderConfirmationHeadingPl,
};

export default async function AccountOrderDetailPage({ params }: AccountOrderDetailPageProps) {
  const { orderNumber } = await params;
  const session = await getSession();
  const order = session === null ? null : await findOrderForUser(decodeURIComponent(orderNumber), session.userId);
  if (order === null) {
    notFound();
  }

  const [reviewStatus, storeSettings] = await Promise.all([
    order.status === 'COMPLETED' ? findReviewStatusForOrder(order.orderNumber) : Promise.resolve(null),
    getStoreSettings(),
  ]);

  return (
    <div>
      <Heading level={1}>{SITE.orderNumberLabelPl}: {order.orderNumber}</Heading>
      <Text muted>{order.email}</Text>
      <OrderSummary order={order} bankDetails={storeSettings} />
      <OrderShipmentInfo shipment={order.shipment} />

      <ThemeRegistry>
        {order.status === 'COMPLETED' &&
          (reviewStatus !== null ? (
            <Text muted>{SITE.reviewAlreadySubmittedPl}</Text>
          ) : (
            <ReviewForm action={submitAccountReview.bind(null, order.orderNumber)} />
          ))}

        <div style={{ marginBlockStart: 32 }}>
          <SupportRequestForm
            action={submitOrderSupportRequest.bind(null, order.orderNumber, null)}
            heading={SITE.contactOrderContextHeadingPl}
            intro={SITE.contactOrderContextIntroPl}
            defaultEmail={order.email}
          />
        </div>
      </ThemeRegistry>
    </div>
  );
}

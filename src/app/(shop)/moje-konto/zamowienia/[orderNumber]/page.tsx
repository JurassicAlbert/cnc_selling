import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { findOrderForUser } from '@/server/repositories/orders';
import { findReviewStatusForOrder } from '@/server/repositories/reviews';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { submitAccountReview } from '@/server/actions/reviews';
import { Heading } from '@/ui/primitives/Heading';
import { OrderSummary } from '@/ui/primitives/OrderSummary';
import { Text } from '@/ui/primitives/Text';
import { ReviewForm } from '@/ui/islands/ReviewForm';

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

      {order.status === 'COMPLETED' &&
        (reviewStatus !== null ? (
          <Text muted>{SITE.reviewAlreadySubmittedPl}</Text>
        ) : (
          <ReviewForm action={submitAccountReview.bind(null, order.orderNumber)} />
        ))}
    </div>
  );
}

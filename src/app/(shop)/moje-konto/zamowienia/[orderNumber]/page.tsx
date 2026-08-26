import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { findOrderForUser } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';
import { OrderSummary } from '@/ui/primitives/OrderSummary';
import { Text } from '@/ui/primitives/Text';

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

  return (
    <div>
      <Heading level={1}>{SITE.orderNumberLabelPl}: {order.orderNumber}</Heading>
      <Text muted>{order.email}</Text>
      <OrderSummary order={order} />
    </div>
  );
}

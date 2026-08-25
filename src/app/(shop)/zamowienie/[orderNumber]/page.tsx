import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { COPY } from '@/content/pl/messages';
import { findOrderForConfirmation } from '@/server/repositories/orders';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

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

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.orderConfirmationHeadingPl}</Heading>

        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text>
            {SITE.orderNumberLabelPl}: {order.orderNumber}
          </Text>
        </div>

        <div style={{ marginBlockStart: 24 }}>
          <Heading level={2}>{SITE.orderItemsHeadingPl}</Heading>
          <div style={{ marginBlockStart: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.items.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: an immutable order snapshot, never reordered or edited
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text muted>
                  {item.snapshot.productNamePl} × {item.quantity}
                  {item.snapshot.materialNamePl !== null || item.snapshot.designNamePl !== null
                    ? ` — ${[item.snapshot.materialNamePl, item.snapshot.designNamePl].filter((v) => v !== null).join(', ')}`
                    : ''}
                </Text>
                <Text muted>{formatPln(item.lineGrossGrosze)}</Text>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: 'var(--mui-font-h5)',
              paddingBlockStart: 8,
              marginBlockStart: 8,
              borderTop: '1px solid var(--mui-palette-divider)',
            }}
          >
            <span>{SITE.orderTotalLabelPl}</span>
            <span>{formatPln(order.totalGrossGrosze)}</span>
          </div>
        </div>

        {order.paymentMethod === 'BANK_TRANSFER' ? (
          <div style={{ marginBlockStart: 24 }}>
            <Heading level={2}>{SITE.orderBankTransferHeadingPl}</Heading>
            <Text>
              {SITE.orderBankTransferTitlePl}: {order.orderNumber}
            </Text>
            <Text muted>{SITE.orderBankTransferAccountPendingPl}</Text>
          </div>
        ) : (
          <div style={{ marginBlockStart: 24 }}>
            <Text>{SITE.orderContactArrangedNoticePl}</Text>
          </div>
        )}

        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.orderEmailFollowUpNoticePl}</Text>
          <Text muted>{COPY.orderReceived}</Text>
        </div>
      </Container>
    </Section>
  );
}

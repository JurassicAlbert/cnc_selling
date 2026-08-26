import type { Metadata } from 'next';
import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { orderStatusMessage } from '@/content/pl/messages';
import { getSession } from '@/server/auth/session';
import { listOrdersForUser } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

export const metadata: Metadata = {
  title: SITE.accountOrdersHeadingPl,
};

export default async function AccountOrdersPage() {
  // Session existence is already guaranteed by `moje-konto/layout.tsx`'s
  // gate — `userId` here is only `null` if that gate somehow let a
  // sessionless request through, in which case there is nothing to list.
  const session = await getSession();
  const orders = session === null ? [] : await listOrdersForUser(session.userId);

  return (
    <div>
      <Heading level={1}>{SITE.accountOrdersHeadingPl}</Heading>

      {orders.length === 0 ? (
        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.accountOrdersEmptyPl}</Text>
          <Link href="/" style={{ display: 'inline-block', marginBlockStart: 12 }}>
            {SITE.accountOrdersEmptyActionPl}
          </Link>
        </div>
      ) : (
        <div style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((order) => (
            <Link
              key={order.orderNumber}
              href={`/moje-konto/zamowienia/${encodeURIComponent(order.orderNumber)}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                border: '1px solid var(--mui-palette-divider)',
                borderRadius: 4,
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              <div>
                <Text>{order.orderNumber}</Text>
                <Text muted>{orderStatusMessage(order.status)}</Text>
              </div>
              <Text>{formatPln(order.totalGrossGrosze)}</Text>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

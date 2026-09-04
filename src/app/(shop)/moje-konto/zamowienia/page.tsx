import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { listOrdersForUser } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';
import { AccountOrdersList } from '@/ui/islands/AccountOrdersList';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: SITE.accountOrdersHeadingPl,
};

export default async function AccountOrdersPage() {
  // Session existence is already guaranteed by `moje-konto/layout.tsx`'s
  // gate - `userId` here is only `null` if that gate somehow let a
  // sessionless request through, in which case there is nothing to list.
  const session = await getSession();
  const orders = session === null ? [] : await listOrdersForUser(session.userId);

  return (
    <div>
      <Heading level={1}>{SITE.accountOrdersHeadingPl}</Heading>
      <div style={{ marginBlockStart: 24 }}>
        <ThemeRegistry>
          <AccountOrdersList orders={orders} />
        </ThemeRegistry>
      </div>
    </div>
  );
}

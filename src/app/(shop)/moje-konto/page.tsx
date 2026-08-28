import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { listMyCustomerDesigns } from '@/server/repositories/customer-designs';
import { listMyFavoriteDesigns } from '@/server/repositories/design-favorites';
import { listOrdersForUser } from '@/server/repositories/orders';
import { listMySupportRequests } from '@/server/repositories/support-requests';
import { AccountDashboard } from '@/ui/islands/AccountDashboard';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: SITE.headerAccountLinkPl,
};

/**
 * P9 continuation, 2026-08-28 — owner feedback verbatim: "Sekcja
 * użytkownika po zalogowaniu dalej jest strasznie biedna" (the account
 * section is still terribly poor). Previously this page was a name plus
 * two bare text links. Now a real dashboard (`AccountDashboard`, the MUI
 * presentational half — kept out of this file since `@mui/material` can't
 * be imported directly in a `(shop)` server component, ARCHITECTURE.md
 * §2.1), pulling together every account resource this session's work made
 * real: order status *and* shipment tracking, uploaded + favourited
 * designs, open support requests.
 */
export default async function AccountOverviewPage() {
  const session = await getSession();
  if (session === null) {
    // moje-konto/layout.tsx's gate already redirects before this can be
    // reached with no session; this satisfies the type only.
    return null;
  }

  const [orders, designs, favoriteDesigns, supportRequests] = await Promise.all([
    listOrdersForUser(session.userId),
    listMyCustomerDesigns(),
    listMyFavoriteDesigns(),
    listMySupportRequests(),
  ]);
  const openSupportRequestCount = supportRequests.filter((r) => r.status === 'NEW' || r.status === 'IN_PROGRESS').length;

  return (
    <ThemeRegistry>
      <AccountDashboard
        name={session.name}
        orders={orders}
        designCount={designs.length}
        favoriteDesignCount={favoriteDesigns.length}
        openSupportRequestCount={openSupportRequestCount}
      />
    </ThemeRegistry>
  );
}

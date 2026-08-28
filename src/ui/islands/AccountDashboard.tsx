/**
 * P9 continuation, 2026-08-28 — the real account dashboard body. No
 * `'use client'`: nothing here is interactive (every action lives on its
 * own sub-page), so this stays a plain Server Component — it only lives
 * under `src/ui/islands` rather than `src/ui/primitives` because it's
 * MUI-based and page-specific, not a shared cross-page primitive. Lives
 * outside `src/app/(marketing)|(shop)` specifically so it CAN import
 * `@mui/material` directly — that import is restricted by biome for
 * `src/app/(marketing)/**`/`src/app/(shop)/**` server components
 * (ARCHITECTURE.md §2.1), not for `src/ui/**`.
 *
 * `justifyContent`/`alignItems`/`flexWrap`/`gap` all go through `sx`, not
 * as direct `Stack` props — matching the established convention (see
 * `DashboardCharts.tsx`), not this MUI version's `Stack` type overload for
 * those as top-level props.
 */

import Link from 'next/link';
import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { orderStatusMessage, shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderSummaryView } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';

const RECENT_ORDERS_LIMIT = 3;

export function AccountDashboard({
  name,
  orders,
  designCount,
  favoriteDesignCount,
  openSupportRequestCount,
}: {
  readonly name: string;
  readonly orders: readonly OrderSummaryView[];
  readonly designCount: number;
  readonly favoriteDesignCount: number;
  readonly openSupportRequestCount: number;
}) {
  const recentOrders = orders.slice(0, RECENT_ORDERS_LIMIT);

  return (
    <div>
      <Heading level={1}>{SITE.headerAccountLinkPl}</Heading>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {SITE.accountOverviewGreetingPl}, {name}
      </Typography>

      <Stack spacing={3} sx={{ mt: 4, maxWidth: 720 }}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{SITE.accountNavOrdersPl}</Typography>
              <Link href="/moje-konto/zamowienia" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.accountViewAllPl}
              </Link>
            </Stack>
            {recentOrders.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {SITE.accountOverviewOrdersEmptyPl}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {recentOrders.map((order) => (
                  <Link
                    key={order.orderNumber}
                    href={`/moje-konto/zamowienia/${encodeURIComponent(order.orderNumber)}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="body2">{order.orderNumber}</Typography>
                        <Chip size="small" label={orderStatusMessage(order.status)} />
                        {order.shipmentStatus !== null && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${SITE.accountOverviewShipmentLabelPl}: ${shipmentStatusMessage(order.shipmentStatus)}`}
                          />
                        )}
                      </Stack>
                      <Typography variant="body2">{formatPln(order.totalGrossGrosze)}</Typography>
                    </Stack>
                  </Link>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{SITE.accountNavDesignsPl}</Typography>
              <Link href="/moje-konto/wzory" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.accountViewAllPl}
              </Link>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {SITE.accountOverviewDesignsSummaryPl(designCount, favoriteDesignCount)}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{SITE.accountNavConfigurationsPl}</Typography>
              <Link href="/moje-konto/projekty" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.accountViewAllPl}
              </Link>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{SITE.accountNavHelpPl}</Typography>
              <Link href="/moje-konto/pomoc" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.accountViewAllPl}
              </Link>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {openSupportRequestCount > 0
                ? SITE.accountOverviewHelpSummaryOpenPl(openSupportRequestCount)
                : SITE.accountOverviewHelpSummaryNonePl}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </div>
  );
}

/**
 * P9 continuation, 2026-08-28 — the real account dashboard body, redesigned
 * again the same day after direct owner feedback that the first pass still
 * "looked vanilla html/css". Real icon badges (reusing the exact icons
 * `AccountNav`'s tabs already use — icon↔section association reinforced,
 * not four new arbitrary icons), an initials `Avatar` in the greeting, a
 * responsive 2-column card grid instead of one long vertical stack, and a
 * real hover lift on each card. No `'use client'`: nothing here is
 * interactive (every action lives on its own sub-page) — lives under
 * `src/ui/islands` only because it needs `@mui/material`, which
 * `src/app/(shop)` server components cannot import directly
 * (ARCHITECTURE.md §2.1 / biome's `noRestrictedImports`).
 *
 * `justifyContent`/`alignItems`/`flexWrap`/`gap` all go through `sx`, not
 * as direct `Stack` props — this MUI version's `Stack` type overload
 * doesn't accept those as top-level props (see `DashboardCharts.tsx`).
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import PaletteIcon from '@mui/icons-material/Palette';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TurnedInIcon from '@mui/icons-material/TurnedIn';
import { Avatar, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

import { formatPln } from '@/domain/money/money';
import { orderStatusMessage, shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderSummaryView } from '@/server/repositories/orders';

const RECENT_ORDERS_LIMIT = 3;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return chars.join('') || '?';
}

function SectionIcon({ Icon }: { readonly Icon: SvgIconComponent }) {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        bgcolor: 'secondary.main',
        color: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon fontSize="small" />
    </Box>
  );
}

function DashboardCard({
  icon,
  heading,
  href,
  children,
}: {
  readonly icon: SvgIconComponent;
  readonly heading: string;
  readonly href: string;
  readonly children?: ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        transition: 'border-color 0.15s ease, transform 0.15s ease',
        '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-2px)' },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: children ? 2 : 0.5 }}>
          <SectionIcon Icon={icon} />
          <Stack direction="row" sx={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{heading}</Typography>
            <Link href={href} style={{ font: 'var(--mui-font-body2)' }}>
              {SITE.accountViewAllPl}
            </Link>
          </Stack>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

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
    <Box>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 4 }}>
        <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56, fontSize: '1.1rem' }}>{initials(name)}</Avatar>
        <Box>
          <Typography variant="h5" component="h1">
            {SITE.headerAccountLinkPl}
          </Typography>
          <Typography color="text.secondary">
            {SITE.accountOverviewGreetingPl}, {name}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <DashboardCard icon={ReceiptLongIcon} heading={SITE.accountNavOrdersPl} href="/moje-konto/zamowienia">
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
          </DashboardCard>
        </Box>

        <DashboardCard icon={PaletteIcon} heading={SITE.accountNavDesignsPl} href="/moje-konto/wzory">
          <Typography variant="body2" color="text.secondary">
            {SITE.accountOverviewDesignsSummaryPl(designCount, favoriteDesignCount)}
          </Typography>
        </DashboardCard>

        <DashboardCard icon={TurnedInIcon} heading={SITE.accountNavConfigurationsPl} href="/moje-konto/projekty" />

        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
          <DashboardCard icon={HelpOutlineIcon} heading={SITE.accountNavHelpPl} href="/moje-konto/pomoc">
            <Typography variant="body2" color="text.secondary">
              {openSupportRequestCount > 0
                ? SITE.accountOverviewHelpSummaryOpenPl(openSupportRequestCount)
                : SITE.accountOverviewHelpSummaryNonePl}
            </Typography>
          </DashboardCard>
        </Box>
      </Box>
    </Box>
  );
}

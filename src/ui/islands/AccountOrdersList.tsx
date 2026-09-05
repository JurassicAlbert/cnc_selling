/**
 * P9 continuation, 2026-08-28 - owner feedback: "zarządzanie zamówieniami
 * itp itd dalej jest zbyt biednie" (order management is still too poor).
 * The old `/moje-konto/zamowienia` page was a bare `<Link>` list of plain
 * divs. Real MUI cards with status/shipment `Chip`s, matching the exact
 * pattern `AccountDashboard.tsx`'s recent-orders block already established
 * (same icon-badge/hover-lift language), just for the *full* history
 * instead of the dashboard's 3-item preview.
 *
 * No `'use client'`: nothing here is interactive, same reasoning as
 * `AccountDashboard.tsx` - lives under `src/ui/islands` only because it
 * needs `@mui/material`, which `src/app/(shop)` server components cannot
 * import directly (ARCHITECTURE.md §2.1).
 */

import Link from 'next/link';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { orderStatusMessage, shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderSummaryView } from '@/server/repositories/orders';

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

export function AccountOrdersList({ orders }: { readonly orders: readonly OrderSummaryView[] }) {
  if (orders.length === 0) {
    return (
      <Box>
        <Typography color="text.secondary">{SITE.accountOrdersEmptyPl}</Typography>
        <Link href="/" style={{ display: 'inline-block', marginTop: 12 }}>
          {SITE.accountOrdersEmptyActionPl}
        </Link>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {orders.map((order) => (
        <Link key={order.orderNumber} href={`/moje-konto/zamowienia/${encodeURIComponent(order.orderNumber)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card
            variant="outlined"
            sx={{
              transition: 'border-color 0.15s ease, transform 0.15s ease',
              '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-2px)' },
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
                  <ReceiptLongIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle1">{order.orderNumber}</Typography>
                    <Typography variant="subtitle1">{formatPln(order.totalGrossGrosze)}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    <Chip
                      size="small"
                      label={orderStatusMessage(order.status)}
                      color={order.status === 'AWAITING_PAYMENT' ? 'warning' : order.status === 'CANCELLED' ? 'error' : 'default'}
                      variant={order.status === 'AWAITING_PAYMENT' || order.status === 'CANCELLED' ? 'filled' : 'outlined'}
                    />
                    {order.shipmentStatus !== null && (
                      <Chip size="small" variant="outlined" label={shipmentStatusMessage(order.shipmentStatus)} />
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {dateFormatter.format(order.createdAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      · {SITE.accountOrdersItemCountPl(order.itemCount)}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Link>
      ))}
    </Stack>
  );
}

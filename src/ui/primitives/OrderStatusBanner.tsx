import { Alert, AlertTitle } from '@mui/material';

import type { OrderStatus } from '@/generated/prisma/enums';
import { orderStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';

/**
 * 2026-08-29, owner feedback: "Jeśli zamówienie zostało rozpoczęte, ale
 * nie skończone, albo płatność nie doszła do skutku to również powinna
 * być możliwość i informacja do kontynuowania z konta klienta" — a real,
 * prominent status banner at the top of both order-confirmation surfaces
 * (guest `/zamowienie/[orderNumber]`, account `/moje-konto/zamowienia/
 * [orderNumber]`), not just a `Chip` buried lower on the page.
 *
 * 2026-08-29 rewrite (same day, next round): first version was raw HTML —
 * owner called it out directly ("Dymki z informacjami to dalej typowy
 * vanilla/raw html/css"). Real MUI `Alert` now (no `'use client'`
 * needed — see `OrderSummary.tsx`'s own header comment for why that's
 * safe here).
 *
 * `AWAITING_PAYMENT`/`CANCELLED` get an explicit, actionable note; every
 * other status just shows the plain status message — `OrderSummary`
 * already shows the real bank-transfer/contact-arranged details right
 * below this on every visit (not just the first), so "how do I finish
 * paying" is already answered there, this banner just makes the STATE
 * impossible to miss first.
 */
export function OrderStatusBanner({ status }: { readonly status: OrderStatus }) {
  const severity = status === 'CANCELLED' ? 'error' : status === 'AWAITING_PAYMENT' ? 'warning' : 'info';

  return (
    <Alert severity={severity} variant="outlined" sx={{ mb: 3 }}>
      <AlertTitle sx={{ fontWeight: 600 }}>{orderStatusMessage(status)}</AlertTitle>
      {status === 'AWAITING_PAYMENT' && SITE.orderAwaitingPaymentNoticePl}
      {status === 'CANCELLED' && SITE.orderCancelledNoticePl}
    </Alert>
  );
}

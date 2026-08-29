import type { OrderStatus } from '@/generated/prisma/enums';
import { orderStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { Text } from '@/ui/primitives/Text';

/**
 * 2026-08-29, owner feedback: "Jeśli zamówienie zostało rozpoczęte, ale
 * nie skończone, albo płatność nie doszła do skutku to również powinna
 * być możliwość i informacja do kontynuowania z konta klienta" — a real,
 * prominent status banner at the top of both order-confirmation surfaces
 * (guest `/zamowienie/[orderNumber]`, account `/moje-konto/zamowienia/
 * [orderNumber]`), not just a `Chip` buried lower on the page. Plain RSC
 * styling (no MUI — both call sites live under `(shop)`, where
 * `ARCHITECTURE.md` §2.1 forbids importing it directly).
 *
 * `AWAITING_PAYMENT`/`CANCELLED` get an explicit, actionable note; every
 * other status just shows the plain status message — `OrderSummary`
 * already shows the real bank-transfer/contact-arranged details right
 * below this on every visit (not just the first), so "how do I finish
 * paying" is already answered there, this banner just makes the STATE
 * impossible to miss first.
 */
export function OrderStatusBanner({ status }: { readonly status: OrderStatus }) {
  const tone = status === 'CANCELLED' ? 'var(--mui-palette-error-main)' : status === 'AWAITING_PAYMENT' ? 'var(--mui-palette-warning-main, #b26a00)' : 'var(--mui-palette-secondary-main)';

  return (
    <div
      style={{
        marginBlockStart: 16,
        padding: '12px 16px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${tone}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <p style={{ font: 'var(--mui-font-subtitle1)', color: tone, fontWeight: 600, margin: 0 }}>{orderStatusMessage(status)}</p>
      {status === 'AWAITING_PAYMENT' && <Text muted>{SITE.orderAwaitingPaymentNoticePl}</Text>}
      {status === 'CANCELLED' && <Text muted>{SITE.orderCancelledNoticePl}</Text>}
    </div>
  );
}

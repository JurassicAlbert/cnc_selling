import { Alert, Divider, Paper, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import type { OrderConfirmationView } from '@/server/repositories/orders';

/**
 * The items/total/delivery/payment-instructions block shared by the guest
 * order-confirmation page (`(shop)/zamowienie/[orderNumber]/page.tsx`), the
 * logged-in order-history detail page
 * (`(shop)/moje-konto/zamowienia/[orderNumber]/page.tsx`), and the admin
 * order page (`(admin)/panel/zamowienia/[orderNumber]/page.tsx`) - same
 * `OrderConfirmationView`-shaped data, same display, extracted once a
 * second real caller needed it rather than duplicated.
 *
 * 2026-08-29 rewrite, owner feedback: "Dymki z informacjami to dalej
 * typowy vanilla/raw html/css" - real MUI now. No `'use client'` needed
 * (no interactivity) - lives in `ui/primitives`, outside the `(shop)`/
 * `(marketing)` app directories the `@mui/material`-ban lint rule scopes
 * to (`ARCHITECTURE.md` §2.1), so it renders fine as a plain Server
 * Component as long as an ancestor mounts `ThemeRegistry` - same
 * `DuplicateButton.tsx` precedent. Both customer-facing call sites now
 * render this INSIDE their own `ThemeRegistry` wrap (it used to sit
 * outside, back when this was plain HTML).
 *
 * Also fixes a second real gap the owner flagged directly: the delivery
 * method and pickup point a customer actually chose were never shown back
 * to them anywhere - `deliveryMethodNamePl`/`pickupPointLabel` are real
 * fields on `Order` (P9 continuation, round 9) that simply weren't wired
 * into this view yet.
 */
export type OrderSummaryBankDetails = {
  readonly bankAccountNumber: string | null;
  readonly bankAccountHolderPl: string | null;
};

/**
 * Only the fields this component actually reads - deliberately narrower
 * than `OrderConfirmationView` so a field added there for one caller (e.g.
 * P9 phase 7's `shipment`) never forces every other caller's own view type
 * (`AdminOrderView` here) to grow a matching field it has no use for.
 */
type OrderSummaryOrderView = Pick<
  OrderConfirmationView,
  'orderNumber' | 'paymentMethod' | 'totalGrossGrosze' | 'items' | 'deliveryMethodNamePl' | 'pickupPointLabel'
>;

export function OrderSummary({
  order,
  bankDetails,
}: {
  readonly order: OrderSummaryOrderView;
  readonly bankDetails: OrderSummaryBankDetails;
}) {
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {SITE.orderItemsHeadingPl}
        </Typography>
        <Stack spacing={1}>
          {order.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an immutable order snapshot, never reordered or edited
            <Stack key={index} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {item.snapshot.productNamePl} × {item.quantity}
                {item.snapshot.materialNamePl !== null || item.snapshot.designNamePl !== null
                  ? ` - ${[item.snapshot.materialNamePl, item.snapshot.designNamePl].filter((v) => v !== null).join(', ')}`
                  : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {formatPln(item.lineGrossGrosze)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">{SITE.orderTotalLabelPl}</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {formatPln(order.totalGrossGrosze)}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {SITE.orderDeliveryMethodHeadingPl}
        </Typography>
        <Typography variant="body2">{order.deliveryMethodNamePl}</Typography>
        {order.pickupPointLabel !== null && (
          <Typography variant="body2" color="text.secondary">
            {order.pickupPointLabel}
          </Typography>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {order.paymentMethod === 'BANK_TRANSFER' ? SITE.orderBankTransferHeadingPl : SITE.checkoutPaymentSectionHeadingPl}
        </Typography>
        {order.paymentMethod === 'BANK_TRANSFER' ? (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              {SITE.orderBankTransferTitlePl}: <strong>{order.orderNumber}</strong>
            </Typography>
            {bankDetails.bankAccountNumber !== null ? (
              <>
                <Typography variant="body2">
                  {SITE.orderBankTransferAccountLabelPl}: {bankDetails.bankAccountNumber}
                </Typography>
                {bankDetails.bankAccountHolderPl !== null && (
                  <Typography variant="body2" color="text.secondary">
                    {bankDetails.bankAccountHolderPl}
                  </Typography>
                )}
              </>
            ) : (
              <Alert severity="info" sx={{ mt: 0.5 }}>
                {SITE.orderBankTransferAccountPendingPl}
              </Alert>
            )}
          </Stack>
        ) : (
          <Typography variant="body2">{SITE.orderContactArrangedNoticePl}</Typography>
        )}
      </Paper>
    </Stack>
  );
}

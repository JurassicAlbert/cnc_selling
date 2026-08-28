/**
 * P9 continuation, 2026-08-28 — owner feedback: "zarządzanie zamówieniami
 * itp itd dalej jest zbyt biednie" (order management is still too poor).
 * Replaces the plain-`<div>` `OrderSummary`/`OrderShipmentInfo` primitives
 * on the account order-detail page specifically — those two stay untouched
 * for their other two callers (`(shop)/zamowienie/[orderNumber]` — a guest
 * confirmation page with no MUI mounted, and the admin order page, which
 * has its own dedicated admin chrome already) — this is a real MUI
 * `Card`/`Chip`/`Divider` rebuild for the account panel's own detail view.
 *
 * No `'use client'`: nothing here is interactive — lives under
 * `src/ui/islands` only for `@mui/material` access (ARCHITECTURE.md §2.1).
 */

import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { Alert, Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderConfirmationView, OrderShipmentView } from '@/server/repositories/orders';

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

type OrderDetailBankDetails = {
  readonly bankAccountNumber: string | null;
  readonly bankAccountHolderPl: string | null;
};

function CardHeading({ icon: Icon, heading }: { readonly icon: typeof ReceiptLongIcon; readonly heading: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
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
      <Typography variant="h6">{heading}</Typography>
    </Stack>
  );
}

function ShipmentDetail({ shipment }: { readonly shipment: OrderShipmentView }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip size="small" color="secondary" label={shipmentStatusMessage(shipment.status)} />
      </Stack>
      {shipment.carrier !== null && (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentCarrierLabelPl}: {shipment.carrier}
        </Typography>
      )}
      {shipment.trackingNumber !== null && (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentTrackingNumberLabelPl}: {shipment.trackingNumber}
        </Typography>
      )}
      {shipment.shippedAt !== null && (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentShippedAtLabelPl}: {dateFormatter.format(shipment.shippedAt)}
        </Typography>
      )}
      {shipment.estimatedDeliveryAt !== null && (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentEstimatedDeliveryLabelPl}: {dateFormatter.format(shipment.estimatedDeliveryAt)}
        </Typography>
      )}
      {shipment.deliveredAt !== null && (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentDeliveredAtLabelPl}: {dateFormatter.format(shipment.deliveredAt)}
        </Typography>
      )}
      {shipment.customerNotesPl !== null && <Typography variant="body2">{shipment.customerNotesPl}</Typography>}
      {shipment.issueDescriptionPl !== null && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {SITE.orderShipmentIssueLabelPl}: {shipment.issueDescriptionPl}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary">
        {SITE.orderShipmentManualNoticePl}
      </Typography>
    </Stack>
  );
}

export function AccountOrderDetail({
  order,
  bankDetails,
}: {
  readonly order: OrderConfirmationView;
  readonly bankDetails: OrderDetailBankDetails;
}) {
  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <CardHeading icon={ReceiptLongIcon} heading={SITE.orderItemsHeadingPl} />
          <Stack spacing={1.5}>
            {order.items.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: an immutable order snapshot, never reordered or edited
              <Stack key={index} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.snapshot.productNamePl} × {item.quantity}
                  {item.snapshot.materialNamePl !== null || item.snapshot.designNamePl !== null
                    ? ` — ${[item.snapshot.materialNamePl, item.snapshot.designNamePl].filter((v) => v !== null).join(', ')}`
                    : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {formatPln(item.lineGrossGrosze)}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6">{SITE.orderTotalLabelPl}</Typography>
            <Typography variant="h6">{formatPln(order.totalGrossGrosze)}</Typography>
          </Stack>

          {order.paymentMethod === 'BANK_TRANSFER' ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2">{SITE.orderBankTransferHeadingPl}</Typography>
              <Typography variant="body2" color="text.secondary">
                {SITE.orderBankTransferTitlePl}: {order.orderNumber}
              </Typography>
              {bankDetails.bankAccountNumber !== null ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {SITE.orderBankTransferAccountLabelPl}: {bankDetails.bankAccountNumber}
                  </Typography>
                  {bankDetails.bankAccountHolderPl !== null && (
                    <Typography variant="caption" color="text.secondary">
                      {bankDetails.bankAccountHolderPl}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {SITE.orderBankTransferAccountPendingPl}
                </Typography>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 3 }}>
              {SITE.orderContactArrangedNoticePl}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <CardHeading icon={LocalShippingIcon} heading={SITE.orderShipmentHeadingPl} />
          {order.shipment === null ? (
            <Typography color="text.secondary">{SITE.orderShipmentNotYetPreparedPl}</Typography>
          ) : (
            <ShipmentDetail shipment={order.shipment} />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

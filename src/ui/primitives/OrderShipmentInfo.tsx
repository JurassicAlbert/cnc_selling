import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

import { shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderShipmentView } from '@/server/repositories/orders';

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

/**
 * Customer-facing shipment status - P9 phase 7. Deliberately, explicitly
 * honest about being manually updated: no live carrier polling exists
 * anywhere in this project (§9/§15), and this component says so directly
 * rather than presenting a status that looks automatically fresh.
 *
 * 2026-08-29 rewrite, owner feedback: real MUI, not raw HTML (no
 * `'use client'` needed - see `OrderSummary.tsx`'s own header comment for
 * why that's safe here).
 */
export function OrderShipmentInfo({ shipment }: { readonly shipment: OrderShipmentView | null }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {SITE.orderShipmentHeadingPl}
      </Typography>

      {shipment === null ? (
        <Typography variant="body2" color="text.secondary">
          {SITE.orderShipmentNotYetPreparedPl}
        </Typography>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2">{SITE.orderShipmentStatusLabelPl}:</Typography>
            <Chip size="small" label={shipmentStatusMessage(shipment.status)} />
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
            <Alert severity="warning" sx={{ mt: 0.5 }}>
              {SITE.orderShipmentIssueLabelPl}: {shipment.issueDescriptionPl}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary">
            {SITE.orderShipmentManualNoticePl}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}

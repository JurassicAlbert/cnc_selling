'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminShipmentStatusLabel } from '@/content/pl/admin';
import type { AdminShipmentDetail } from '@/server/repositories/admin-shipments';
import { upsertShipment } from '@/server/actions/admin-shipments';
import type { ShipmentMutationResult } from '@/server/actions/admin-shipments';
import type { ShipmentStatus } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const STATUSES: readonly ShipmentStatus[] = ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'ISSUE', 'RETURNED'];
const INITIAL_STATE: ShipmentMutationResult = { ok: true };

function toDateInputValue(date: Date | null | undefined): string {
  if (date === null || date === undefined) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

/**
 * P9 phase 7 — one order, one `Shipment`, always upserted, never a
 * separate create/edit page: this IS the create form the first time (no
 * `shipment` prop), and becomes the edit form once one exists. Manual
 * only — every field here is exactly what a staff member typed, no
 * carrier API anywhere behind it (§9/§15).
 */
export function ShipmentEditor({
  orderNumber,
  orderId,
  shipment,
}: {
  readonly orderNumber: string;
  readonly orderId: string;
  readonly shipment: AdminShipmentDetail | null;
}) {
  const { capture, fieldValue, resetKey } = usePreservedFormValues();

  const action = async (_prev: ShipmentMutationResult, formData: FormData) => {
    capture(formData);
    return upsertShipment(orderNumber, orderId, formData);
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={2} sx={{ mt: 4, maxWidth: 480 }}>
      <Typography variant="h6">{ADMIN.shipmentHeadingPl}</Typography>
      <Typography variant="caption" color="text.secondary">
        {ADMIN.shipmentManualNoticePl}
      </Typography>

      <form action={formAction}>
        <Stack spacing={2}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                key={resetKey}
                fullWidth
                select
                label={ADMIN.shipmentFieldStatusPl}
                name="status"
                defaultValue={fieldValue('status', shipment?.status ?? 'PREPARING')}
                size="small"
              >
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {adminShipmentStatusLabel(s)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldCarrierPl}
                name="carrier"
                defaultValue={fieldValue('carrier', shipment?.carrier ?? '')}
                size="small"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldTrackingNumberPl}
                name="trackingNumber"
                defaultValue={fieldValue('trackingNumber', shipment?.trackingNumber ?? '')}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                type="date"
                label={ADMIN.shipmentFieldShippedAtPl}
                name="shippedAt"
                defaultValue={fieldValue('shippedAt', toDateInputValue(shipment?.shippedAt))}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                type="date"
                label={ADMIN.shipmentFieldEstimatedDeliveryAtPl}
                name="estimatedDeliveryAt"
                defaultValue={fieldValue('estimatedDeliveryAt', toDateInputValue(shipment?.estimatedDeliveryAt))}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                type="date"
                label={ADMIN.shipmentFieldDeliveredAtPl}
                name="deliveredAt"
                defaultValue={fieldValue('deliveredAt', toDateInputValue(shipment?.deliveredAt))}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldCustomerNotesPl}
                name="customerNotesPl"
                defaultValue={fieldValue('customerNotesPl', shipment?.customerNotesPl ?? '')}
                size="small"
                multiline
                minRows={2}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldIssueDescriptionPl}
                name="issueDescriptionPl"
                defaultValue={fieldValue('issueDescriptionPl', shipment?.issueDescriptionPl ?? '')}
                size="small"
                multiline
                minRows={2}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldIssueResolutionPl}
                name="issueResolutionPl"
                defaultValue={fieldValue('issueResolutionPl', shipment?.issueResolutionPl ?? '')}
                size="small"
                multiline
                minRows={2}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.shipmentFieldInternalNotesPl}
                name="internalNotesPl"
                defaultValue={fieldValue('internalNotesPl', shipment?.internalNotesPl ?? '')}
                size="small"
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>

          <SubmitButton />
        </Stack>
      </form>
    </Stack>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.shipmentSavePl}
    </Button>
  );
}

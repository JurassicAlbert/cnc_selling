'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FormControlLabel, Grid, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminDeliveryMethodDetail } from '@/server/repositories/admin-delivery-methods';
import { createDeliveryMethod, updateDeliveryMethod } from '@/server/actions/admin-delivery-methods';
import type { DeliveryMethodMutationResult } from '@/server/actions/admin-delivery-methods';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: DeliveryMethodMutationResult = { ok: true, id: '' };

export function DeliveryMethodForm({ method }: { readonly method?: AdminDeliveryMethodDetail }) {
  const router = useRouter();
  const { capture, fieldValue, fieldChecked, resetKey } = usePreservedFormValues();

  const action = async (_prev: DeliveryMethodMutationResult, formData: FormData) => {
    capture(formData);
    const result = method === undefined ? await createDeliveryMethod(formData) : await updateDeliveryMethod(method.id, formData);
    if (result.ok && method === undefined) {
      router.push(`/panel/dostawa/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.deliveryMethodFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', method?.namePl)} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.deliveryMethodFieldCarrierPl} name="carrier" defaultValue={fieldValue('carrier', method?.carrier ?? '')} size="small" />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldDescPl}
              name="descPl"
              defaultValue={fieldValue('descPl', method?.descPl)}
              required
              multiline
              minRows={2}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldPricePl}
              name="pricePln"
              type="number"
              defaultValue={fieldValue('pricePln', method !== undefined ? String(method.priceGrosze / 100) : '0')}
              size="small"
              slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldFreeThresholdPl}
              name="freeShippingThresholdPln"
              type="number"
              defaultValue={fieldValue('freeShippingThresholdPln', method?.freeShippingThresholdGrosze !== null && method?.freeShippingThresholdGrosze !== undefined ? String(method.freeShippingThresholdGrosze / 100) : '')}
              size="small"
              slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
              helperText={ADMIN.deliveryMethodFieldFreeThresholdHelperPl}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldDaysMinPl}
              name="estimatedDaysMin"
              type="number"
              defaultValue={fieldValue('estimatedDaysMin', String(method?.estimatedDaysMin ?? 1))}
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldDaysMaxPl}
              name="estimatedDaysMax"
              type="number"
              defaultValue={fieldValue('estimatedDaysMax', String(method?.estimatedDaysMax ?? 3))}
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label={ADMIN.deliveryMethodFieldSortOrderPl}
              name="sortOrder"
              type="number"
              defaultValue={fieldValue('sortOrder', String(method?.sortOrder ?? 0))}
              size="small"
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={<Checkbox key={resetKey} name="trackingAvailable" defaultChecked={fieldChecked('trackingAvailable', method?.trackingAvailable ?? false)} />}
          label={ADMIN.deliveryMethodFieldTrackingAvailablePl}
        />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.savePl}
    </Button>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminPaymentMethodLabel } from '@/content/pl/admin';
import type { AdminPaymentMethodDetail } from '@/server/repositories/admin-payment-methods';
import { createPaymentMethodConfig, updatePaymentMethodConfig } from '@/server/actions/admin-payment-methods';
import type { PaymentMethodConfigMutationResult } from '@/server/actions/admin-payment-methods';
import type { PaymentMethod } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const PROVIDERS: readonly PaymentMethod[] = ['BANK_TRANSFER', 'CONTACT_ARRANGED', 'PRZELEWY24', 'CARD', 'PAYPAL'];
const INITIAL_STATE: PaymentMethodConfigMutationResult = { ok: true, id: '' };

export function PaymentMethodConfigForm({ method }: { readonly method?: AdminPaymentMethodDetail }) {
  const router = useRouter();
  const { capture, fieldValue, resetKey } = usePreservedFormValues();

  const action = async (_prev: PaymentMethodConfigMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      namePl: String(formData.get('namePl') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      provider: String(formData.get('provider') ?? '') as PaymentMethod,
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = method === undefined ? await createPaymentMethodConfig(input) : await updatePaymentMethodConfig(method.id, input);
    if (result.ok && method === undefined) {
      router.push(`/panel/platnosci/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <>
      {method !== undefined && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <Chip
            size="small"
            label={method.isConnected ? ADMIN.paymentMethodConnectedYesPl : ADMIN.paymentMethodConnectedNoPl}
            color={method.isConnected ? 'success' : 'default'}
          />
        </Stack>
      )}
      {method === undefined && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, maxWidth: 480 }}>
          {ADMIN.paymentMethodConnectedHelperPl}
        </Typography>
      )}
      <form action={formAction}>
        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={ADMIN.paymentMethodFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', method?.namePl)} required size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                key={resetKey}
                fullWidth
                select
                label={ADMIN.paymentMethodFieldProviderPl}
                name="provider"
                defaultValue={fieldValue('provider', method?.provider ?? PROVIDERS[0])}
                size="small"
              >
                {PROVIDERS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {adminPaymentMethodLabel(p)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label={ADMIN.paymentMethodFieldDescPl}
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
                label={ADMIN.paymentMethodFieldSortOrderPl}
                name="sortOrder"
                type="number"
                defaultValue={fieldValue('sortOrder', String(method?.sortOrder ?? 0))}
                size="small"
              />
            </Grid>
          </Grid>

          <SubmitButton />
        </Stack>
      </form>
    </>
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

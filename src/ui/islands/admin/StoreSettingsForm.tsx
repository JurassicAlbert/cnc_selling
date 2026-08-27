'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { updateStoreSettings } from '@/server/actions/admin-store-settings';
import type { UpdateStoreSettingsResult } from '@/server/actions/admin-store-settings';
import type { StoreSettingsView } from '@/server/repositories/store-settings';

const INITIAL_STATE: UpdateStoreSettingsResult = { ok: true };

function grosze(formData: FormData, key: string): number {
  return Math.round(Number(formData.get(key) ?? 0) * 100);
}

export function StoreSettingsForm({ settings }: { readonly settings: StoreSettingsView }) {
  const [saved, setSaved] = useState(false);
  const action = async (_prev: UpdateStoreSettingsResult, formData: FormData) => {
    const result = await updateStoreSettings({
      bankAccountNumber: String(formData.get('bankAccountNumber') ?? ''),
      bankAccountHolderPl: String(formData.get('bankAccountHolderPl') ?? ''),
      shippingFlatRateGrosze: grosze(formData, 'shippingFlatRatePln'),
    });
    setSaved(result.ok);
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}
        {state.ok && saved && <Alert severity="success">{ADMIN.settingsSavedNoticePl}</Alert>}

        <TextField
          label={ADMIN.settingsFieldBankAccountNumberPl}
          name="bankAccountNumber"
          defaultValue={settings.bankAccountNumber ?? ''}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldBankAccountHolderPl}
          name="bankAccountHolderPl"
          defaultValue={settings.bankAccountHolderPl ?? ''}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldShippingRatePl}
          name="shippingFlatRatePln"
          type="number"
          defaultValue={settings.shippingFlatRateGrosze / 100}
          size="small"
          sx={{ maxWidth: 200 }}
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

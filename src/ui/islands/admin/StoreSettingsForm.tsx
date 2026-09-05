'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { updateStoreSettings } from '@/server/actions/admin-store-settings';
import type { UpdateStoreSettingsResult } from '@/server/actions/admin-store-settings';
import type { StoreSettingsView } from '@/server/repositories/store-settings';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: UpdateStoreSettingsResult = { ok: true };

function grosze(formData: FormData, key: string): number {
  return Math.round(Number(formData.get(key) ?? 0) * 100);
}

export function StoreSettingsForm({ settings }: { readonly settings: StoreSettingsView }) {
  const [saved, setSaved] = useState(false);
  const { capture, fieldValue } = usePreservedFormValues();
  const action = async (_prev: UpdateStoreSettingsResult, formData: FormData) => {
    capture(formData);
    const result = await updateStoreSettings({
      bankAccountNumber: String(formData.get('bankAccountNumber') ?? ''),
      bankAccountHolderPl: String(formData.get('bankAccountHolderPl') ?? ''),
      shippingFlatRateGrosze: grosze(formData, 'shippingFlatRatePln'),
      facebookUrl: String(formData.get('facebookUrl') ?? ''),
      instagramUrl: String(formData.get('instagramUrl') ?? ''),
      tiktokUrl: String(formData.get('tiktokUrl') ?? ''),
      youtubeUrl: String(formData.get('youtubeUrl') ?? ''),
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
          defaultValue={fieldValue('bankAccountNumber', settings.bankAccountNumber ?? '')}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldBankAccountHolderPl}
          name="bankAccountHolderPl"
          defaultValue={fieldValue('bankAccountHolderPl', settings.bankAccountHolderPl ?? '')}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldShippingRatePl}
          name="shippingFlatRatePln"
          type="number"
          defaultValue={fieldValue('shippingFlatRatePln', String(settings.shippingFlatRateGrosze / 100))}
          size="small"
          sx={{ maxWidth: 320 }}
          helperText={ADMIN.settingsFieldShippingRateHelperPl}
        />

        {/*
          The shop's social profiles, shown in the strip above the storefront
          navigation (owner request, 2026-09-04). Empty by design until
          somebody fills them in: a hard-coded profile URL would be a guess
          about an account that may not exist, and the strip renders nothing
          for a field left blank rather than an icon linking nowhere.

          `type="url"` for the keyboard it brings up, not for validation -
          the real check is server-side in `applyUpdateStoreSettings`
          (absolute https only, because these become an `href` on every page
          of the storefront).
        */}
        <Typography variant="subtitle2" sx={{ pt: 1 }}>
          {ADMIN.settingsSocialHeadingPl}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ADMIN.settingsSocialHelperPl}
        </Typography>
        <TextField
          label={ADMIN.settingsFieldFacebookPl}
          name="facebookUrl"
          type="url"
          placeholder="https://www.facebook.com/..."
          defaultValue={fieldValue('facebookUrl', settings.facebookUrl ?? '')}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldInstagramPl}
          name="instagramUrl"
          type="url"
          placeholder="https://www.instagram.com/..."
          defaultValue={fieldValue('instagramUrl', settings.instagramUrl ?? '')}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldTiktokPl}
          name="tiktokUrl"
          type="url"
          placeholder="https://www.tiktok.com/@..."
          defaultValue={fieldValue('tiktokUrl', settings.tiktokUrl ?? '')}
          size="small"
        />
        <TextField
          label={ADMIN.settingsFieldYoutubePl}
          name="youtubeUrl"
          type="url"
          placeholder="https://www.youtube.com/@..."
          defaultValue={fieldValue('youtubeUrl', settings.youtubeUrl ?? '')}
          size="small"
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

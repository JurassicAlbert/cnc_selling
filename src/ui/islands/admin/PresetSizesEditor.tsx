'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminPresetSize } from '@/server/repositories/admin-products';
import { addPresetSize, removePresetSize } from '@/server/actions/admin-product-catalogue';
import type { ActionResult } from '@/server/actions/admin-product-catalogue';

const INITIAL_STATE: ActionResult = { ok: true };

export function PresetSizesEditor({ productId, sizes }: { readonly productId: string; readonly sizes: readonly AdminPresetSize[] }) {
  const action = async (_prev: ActionResult, formData: FormData) =>
    addPresetSize(productId, {
      widthMm: Number(formData.get('widthMm') ?? 0),
      heightMm: Number(formData.get('heightMm') ?? 0),
      labelPl: String(formData.get('labelPl') ?? ''),
      sortOrder: sizes.length,
    });
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 560 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionPresetSizesPl}</Typography>
      {sizes.length === 0 && <Typography color="text.secondary">{ADMIN.presetSizesEmptyPl}</Typography>}
      {sizes.map((size) => (
        <Stack key={size.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {size.labelPl} ({size.widthMm} × {size.heightMm} mm)
          </Typography>
          <form action={removePresetSize.bind(null, productId, size.id)}>
            <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
              ✕
            </IconButton>
          </form>
        </Stack>
      ))}

      <form action={formAction}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', mt: 1 }}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}
          <TextField label={ADMIN.presetSizeFieldWidthPl} name="widthMm" type="number" size="small" sx={{ width: 130 }} />
          <TextField label={ADMIN.presetSizeFieldHeightPl} name="heightMm" type="number" size="small" sx={{ width: 130 }} />
          <TextField label={ADMIN.presetSizeFieldLabelPl} name="labelPl" size="small" sx={{ width: 160 }} />
          <SubmitButton />
        </Stack>
      </form>
    </Stack>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" size="small" disabled={pending}>
      {ADMIN.addPl}
    </Button>
  );
}

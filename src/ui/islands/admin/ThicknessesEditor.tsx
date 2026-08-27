'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminThickness } from '@/server/repositories/admin-products';
import { addThickness, removeThickness } from '@/server/actions/admin-product-catalogue';
import type { ActionResult } from '@/server/actions/admin-product-catalogue';

const INITIAL_STATE: ActionResult = { ok: true };

export function ThicknessesEditor({ productId, thicknesses }: { readonly productId: string; readonly thicknesses: readonly AdminThickness[] }) {
  const action = async (_prev: ActionResult, formData: FormData) =>
    addThickness(productId, {
      thicknessMm: Number(formData.get('thicknessMm') ?? 0),
      labelPl: String(formData.get('labelPl') ?? ''),
      priceFactorBp: Math.round(Number(formData.get('priceFactorPct') ?? 100) * 100),
      sortOrder: thicknesses.length,
    });
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 560 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionThicknessesPl}</Typography>
      {thicknesses.length === 0 && <Typography color="text.secondary">{ADMIN.thicknessesEmptyPl}</Typography>}
      {thicknesses.map((thickness) => (
        <Stack key={thickness.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {thickness.labelPl} — ×{(thickness.priceFactorBp / 100).toFixed(0)}%
          </Typography>
          <form action={removeThickness.bind(null, productId, thickness.id)}>
            <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
              ✕
            </IconButton>
          </form>
        </Stack>
      ))}

      <form action={formAction}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', mt: 1 }}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}
          <TextField label={ADMIN.thicknessFieldMmPl} name="thicknessMm" type="number" size="small" sx={{ width: 130 }} />
          <TextField label={ADMIN.thicknessFieldLabelPl} name="labelPl" size="small" sx={{ width: 130 }} />
          <TextField label={ADMIN.thicknessFieldPriceFactorPl} name="priceFactorPct" type="number" defaultValue={100} size="small" sx={{ width: 130 }} />
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

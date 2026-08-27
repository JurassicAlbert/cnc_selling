'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import type { AdminDesignOption, AdminProductDesign } from '@/server/repositories/admin-products';
import { removeProductDesign, setProductDesign } from '@/server/actions/admin-product-catalogue';
import type { ActionResult } from '@/server/actions/admin-product-catalogue';

const INITIAL_STATE: ActionResult = { ok: true };

export function DesignAssignEditor({
  productId,
  designs,
  options,
}: {
  readonly productId: string;
  readonly designs: readonly AdminProductDesign[];
  readonly options: readonly AdminDesignOption[];
}) {
  const available = options.filter((option) => !designs.some((d) => d.designId === option.id));

  const action = async (_prev: ActionResult, formData: FormData) =>
    setProductDesign(productId, String(formData.get('designId') ?? ''), Math.round(Number(formData.get('surchargePln') ?? 0) * 100));
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 560 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionDesignsPl}</Typography>
      {designs.length === 0 && <Typography color="text.secondary">{ADMIN.designAssignEmptyPl}</Typography>}
      {designs.map((design) => (
        <Stack key={design.designId} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {design.code} — {design.namePl} ({formatPln(design.surchargeGrosze)})
          </Typography>
          <form action={removeProductDesign.bind(null, productId, design.designId)}>
            <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
              ✕
            </IconButton>
          </form>
        </Stack>
      ))}

      {available.length > 0 && (
        <form action={formAction}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', mt: 1 }}>
            {!state.ok && <Alert severity="error">{state.detail}</Alert>}
            <TextField select label={ADMIN.designAssignFieldDesignPl} name="designId" size="small" sx={{ width: 220 }} defaultValue={available[0]?.id}>
              {available.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.code} — {option.namePl}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={ADMIN.designAssignFieldSurchargePl} name="surchargePln" type="number" defaultValue={0} size="small" sx={{ width: 130 }} />
            <SubmitButton />
          </Stack>
        </form>
      )}
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

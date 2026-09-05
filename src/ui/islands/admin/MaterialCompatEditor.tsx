'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminMaterialOption, AdminProductMaterial } from '@/server/repositories/admin-products';
import { removeProductMaterial, setProductMaterial } from '@/server/actions/admin-product-catalogue';
import type { ActionResult } from '@/server/actions/admin-product-catalogue';

const INITIAL_STATE: ActionResult = { ok: true };

export function MaterialCompatEditor({
  productId,
  materials,
  options,
}: {
  readonly productId: string;
  readonly materials: readonly AdminProductMaterial[];
  readonly options: readonly AdminMaterialOption[];
}) {
  const available = options.filter((option) => !materials.some((m) => m.materialId === option.id));

  const action = async (_prev: ActionResult, formData: FormData) =>
    setProductMaterial(productId, String(formData.get('materialId') ?? ''), Math.round(Number(formData.get('priceFactorPct') ?? 100) * 100));
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 560 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionMaterialsPl}</Typography>
      {materials.length === 0 && <Typography color="text.secondary">{ADMIN.materialCompatEmptyPl}</Typography>}
      {materials.map((material) => (
        <Stack key={material.materialId} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {material.namePl} - ×{(material.priceFactorBp / 100).toFixed(0)}%
          </Typography>
          <form action={removeProductMaterial.bind(null, productId, material.materialId)}>
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
            <TextField select label={ADMIN.materialCompatFieldMaterialPl} name="materialId" size="small" sx={{ width: 200 }} defaultValue={available[0]?.id}>
              {available.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.namePl}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={ADMIN.materialCompatFieldPriceFactorPl} name="priceFactorPct" type="number" defaultValue={100} size="small" sx={{ width: 130 }} />
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

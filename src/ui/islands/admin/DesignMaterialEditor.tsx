'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminDesignMaterial } from '@/server/repositories/admin-designs';
import type { AdminMaterialOption } from '@/server/repositories/admin-products';
import { addDesignMaterial, removeDesignMaterial } from '@/server/actions/admin-design-materials';
import type { ActionResult } from '@/server/actions/admin-design-materials';

const INITIAL_STATE: ActionResult = { ok: true };

export function DesignMaterialEditor({
  designId,
  materials,
  options,
}: {
  readonly designId: string;
  readonly materials: readonly AdminDesignMaterial[];
  readonly options: readonly AdminMaterialOption[];
}) {
  const available = options.filter((option) => !materials.some((m) => m.materialId === option.id));

  const action = async (_prev: ActionResult, formData: FormData) =>
    addDesignMaterial(designId, String(formData.get('materialId') ?? ''));
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 480 }}>
      <Typography variant="subtitle1">{ADMIN.designMaterialsHeadingPl}</Typography>
      {materials.length === 0 && <Typography color="text.secondary">{ADMIN.designMaterialsEmptyPl}</Typography>}
      {materials.map((material) => (
        <Stack key={material.materialId} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>{material.namePl}</Typography>
          <form action={removeDesignMaterial.bind(null, designId, material.materialId)}>
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
            <TextField select label={ADMIN.designMaterialFieldPl} name="materialId" size="small" sx={{ width: 220 }} defaultValue={available[0]?.id}>
              {available.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.namePl}
                </MenuItem>
              ))}
            </TextField>
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

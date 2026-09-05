'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminFinishOption } from '@/server/repositories/admin-finishes';
import type { AdminMaterialFinish } from '@/server/repositories/admin-materials';
import { addMaterialFinish, removeMaterialFinish } from '@/server/actions/admin-material-finishes';
import type { ActionResult } from '@/server/actions/admin-material-finishes';

const INITIAL_STATE: ActionResult = { ok: true };

export function MaterialFinishEditor({
  materialId,
  finishes,
  options,
}: {
  readonly materialId: string;
  readonly finishes: readonly AdminMaterialFinish[];
  readonly options: readonly AdminFinishOption[];
}) {
  const available = options.filter((option) => !finishes.some((f) => f.finishId === option.id));

  const action = async (_prev: ActionResult, formData: FormData) =>
    addMaterialFinish(materialId, String(formData.get('finishId') ?? ''));
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 480 }}>
      <Typography variant="subtitle1">{ADMIN.materialFinishesHeadingPl}</Typography>
      {finishes.length === 0 && <Typography color="text.secondary">{ADMIN.materialFinishesEmptyPl}</Typography>}
      {finishes.map((finish) => (
        <Stack key={finish.finishId} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>{finish.namePl}</Typography>
          <form action={removeMaterialFinish.bind(null, materialId, finish.finishId)}>
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
            <TextField select label={ADMIN.materialFinishFieldPl} name="finishId" size="small" sx={{ width: 220 }} defaultValue={available[0]?.id}>
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

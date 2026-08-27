'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminFinishKindLabel } from '@/content/pl/admin';
import type { AdminFinishDetail } from '@/server/repositories/admin-finishes';
import { createFinish, updateFinish } from '@/server/actions/admin-finishes';
import type { FinishMutationResult } from '@/server/actions/admin-finishes';
import type { FinishKind } from '@/generated/prisma/enums';
import { FileInputButton } from './FileInputButton';

const KINDS: readonly FinishKind[] = ['NATURAL', 'OIL', 'HARDWAX_OIL', 'STAIN', 'VARNISH'];
const INITIAL_STATE: FinishMutationResult = { ok: true, id: '' };

export function FinishForm({ finish }: { readonly finish?: AdminFinishDetail }) {
  const router = useRouter();

  const action = async (_prev: FinishMutationResult, formData: FormData) => {
    const result = finish === undefined ? await createFinish(formData) : await updateFinish(finish.id, formData);
    if (result.ok && finish === undefined) {
      router.push(`/panel/wykonczenia/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} encType="multipart/form-data">
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.finishFieldSlugPl} name="slug" defaultValue={finish?.slug} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.finishFieldNamePl} name="namePl" defaultValue={finish?.namePl} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label={ADMIN.finishFieldKindPl} name="kind" defaultValue={finish?.kind ?? KINDS[0]} size="small">
              {KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {adminFinishKindLabel(k)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <TextField label={ADMIN.finishFieldDescPl} name="descPl" defaultValue={finish?.descPl} multiline minRows={2} size="small" />

        {finish !== undefined && (
          // biome-ignore lint/performance/noImgElement: admin preview of the current catalogue photo, served straight from public/
          <img src={finish.imageUrl} alt={finish.namePl} style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 4 }} />
        )}
        <div>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {finish === undefined ? ADMIN.finishFieldImagePl : ADMIN.finishFieldImageReplacePl}
          </Typography>
          <FileInputButton
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required={finish === undefined}
            label={finish === undefined ? ADMIN.finishFieldImagePl : ADMIN.finishFieldImageReplacePl}
            chooseLabel={ADMIN.fileChoosePl}
          />
        </div>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth type="number" label={ADMIN.finishFieldPricePl} name="pricePerM2Pln" defaultValue={finish !== undefined ? finish.pricePerM2Grosze / 100 : 0} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth type="number" label={ADMIN.finishFieldSetupFeePl} name="setupFeePln" defaultValue={finish !== undefined ? finish.setupFeeGrosze / 100 : 0} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth type="number" label={ADMIN.finishFieldExtraDaysMinPl} name="extraDaysMin" defaultValue={finish?.extraDaysMin ?? 0} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth type="number" label={ADMIN.finishFieldExtraDaysMaxPl} name="extraDaysMax" defaultValue={finish?.extraDaysMax ?? 0} size="small" />
          </Grid>
        </Grid>

        <TextField label={ADMIN.finishFieldSortOrderPl} name="sortOrder" type="number" defaultValue={finish?.sortOrder ?? 0} size="small" sx={{ maxWidth: 200 }} />

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

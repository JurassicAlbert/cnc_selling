'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminMaterialFamilyLabel } from '@/content/pl/admin';
import type { AdminMaterialDetail } from '@/server/repositories/admin-materials';
import { createMaterial, updateMaterial } from '@/server/actions/admin-materials';
import type { MaterialMutationResult } from '@/server/actions/admin-materials';
import type { GrainDirection, MaterialFamily } from '@/generated/prisma/enums';

const FAMILIES: readonly MaterialFamily[] = ['SOLID_WOOD', 'PLYWOOD', 'MDF', 'CERAMIC', 'LEATHER', 'OTHER'];
const GRAIN_DIRECTIONS: readonly GrainDirection[] = ['NONE', 'LENGTHWISE'];
const INITIAL_STATE: MaterialMutationResult = { ok: true, id: '' };

export function MaterialForm({ material }: { readonly material?: AdminMaterialDetail }) {
  const router = useRouter();

  const action = async (_prev: MaterialMutationResult, formData: FormData) => {
    const result = material === undefined ? await createMaterial(formData) : await updateMaterial(material.id, formData);
    if (result.ok && material === undefined) {
      router.push(`/panel/materialy/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} encType="multipart/form-data">
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.materialFieldSlugPl} name="slug" defaultValue={material?.slug} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.materialFieldNamePl} name="namePl" defaultValue={material?.namePl} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label={ADMIN.materialFieldFamilyPl} name="family" defaultValue={material?.family ?? FAMILIES[0]} size="small">
              {FAMILIES.map((f) => (
                <MenuItem key={f} value={f}>
                  {adminMaterialFamilyLabel(f)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label={ADMIN.materialFieldGrainDirectionPl} name="grainDirection" defaultValue={material?.grainDirection ?? 'NONE'} size="small">
              {GRAIN_DIRECTIONS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <TextField label={ADMIN.materialFieldShortDescPl} name="shortDescPl" defaultValue={material?.shortDescPl} size="small" />
        <TextField label={ADMIN.materialFieldCharacteristicsPl} name="characteristicsPl" defaultValue={material?.characteristicsPl} multiline minRows={3} size="small" />

        {material !== undefined && (
          // biome-ignore lint/performance/noImgElement: admin preview of the current catalogue photo, served straight from public/
          <img src={material.imageUrl} alt={material.namePl} style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 4 }} />
        )}
        <div>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {material === undefined ? ADMIN.materialFieldImagePl : ADMIN.materialFieldImageReplacePl}
          </Typography>
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required={material === undefined} />
        </div>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldPricePl} name="pricePerM2Pln" defaultValue={material !== undefined ? material.pricePerM2Grosze / 100 : 0} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldMaxSheetWidthPl} name="maxSheetWidthMm" defaultValue={material?.maxSheetWidthMm ?? 1000} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldMaxSheetHeightPl} name="maxSheetHeightMm" defaultValue={material?.maxSheetHeightMm ?? 1000} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldMinLineWidthPl} name="minLineWidthUm" defaultValue={material?.minLineWidthUm ?? 1000} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldMinDetailSpacingPl} name="minDetailSpacingUm" defaultValue={material?.minDetailSpacingUm ?? 1000} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth type="number" label={ADMIN.materialFieldMinTextHeightPl} name="minTextHeightUm" defaultValue={material?.minTextHeightUm ?? 6000} size="small" />
          </Grid>
        </Grid>

        <FormControlLabel control={<Checkbox name="supportsCnc" defaultChecked={material?.supportsCnc ?? true} />} label={ADMIN.materialFieldSupportsCncPl} />
        <FormControlLabel control={<Checkbox name="supportsLaser" defaultChecked={material?.supportsLaser ?? true} />} label={ADMIN.materialFieldSupportsLaserPl} />
        <FormControlLabel control={<Checkbox name="isNaturalVariable" defaultChecked={material?.isNaturalVariable ?? true} />} label={ADMIN.materialFieldNaturalVariablePl} />

        <TextField label={ADMIN.materialFieldSortOrderPl} name="sortOrder" type="number" defaultValue={material?.sortOrder ?? 0} size="small" sx={{ maxWidth: 200 }} />

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

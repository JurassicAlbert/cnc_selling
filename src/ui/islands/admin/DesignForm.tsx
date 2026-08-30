'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminDesignRightsStatusLabel, adminProductionMethodLabel } from '@/content/pl/admin';
import type { AdminCollectionOption, AdminDesignDetail } from '@/server/repositories/admin-designs';
import { createDesign, updateDesign } from '@/server/actions/admin-designs';
import type { DesignMutationResult } from '@/server/actions/admin-designs';
import type { DesignRightsStatus, ProductionMethod } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';
import { FileInputButton } from '@/ui/islands/FileInputButton';

const PRODUCTION_METHODS: readonly ProductionMethod[] = ['CNC_CARVE', 'CNC_ENGRAVE', 'LASER_ENGRAVE', 'MIXED', 'MANUAL_PREP'];
const RIGHTS_STATUSES: readonly DesignRightsStatus[] = [
  'REQUIRES_PERMISSION',
  'APPROVED_COMMERCIAL',
  'PUBLIC_DOMAIN',
  'CUSTOMER_SUPPLIED',
  'RESTRICTED',
];
const INITIAL_STATE: DesignMutationResult = { ok: true, id: '' };

export function DesignForm({
  design,
  collections,
}: {
  readonly design?: AdminDesignDetail;
  readonly collections: readonly AdminCollectionOption[];
}) {
  const router = useRouter();
  const { capture, fieldValue, fieldChecked, resetKey } = usePreservedFormValues();

  const action = async (_prev: DesignMutationResult, formData: FormData) => {
    capture(formData);
    const result = design === undefined ? await createDesign(formData) : await updateDesign(design.id, formData);
    if (result.ok && design === undefined) {
      router.push(`/panel/wzory/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} encType="multipart/form-data">
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Typography variant="subtitle1">{ADMIN.designSectionCorePl}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.designFieldSlugPl} name="slug" defaultValue={fieldValue('slug', design?.slug)} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.designFieldCodePl} name="code" defaultValue={fieldValue('code', design?.code)} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.designFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', design?.namePl)} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              key={resetKey}
              fullWidth
              select
              label={ADMIN.designFieldCollectionPl}
              name="collectionId"
              defaultValue={fieldValue('collectionId', design?.collectionId ?? '')}
              size="small"
            >
              <MenuItem value="">{ADMIN.designFieldCollectionNonePl}</MenuItem>
              {collections.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.namePl}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <TextField label={ADMIN.designFieldDescPl} name="descPl" defaultValue={fieldValue('descPl', design?.descPl ?? '')} multiline minRows={2} size="small" />
        <TextField label={ADMIN.designFieldTagsPl} name="tags" defaultValue={fieldValue('tags', design?.tags.join(', ') ?? '')} size="small" />

        {design !== undefined && (
          <Stack direction="row" spacing={2}>
            {/* biome-ignore lint/performance/noImgElement: admin preview of the current catalogue photo, served straight from public/ */}
            <img src={design.thumbnailUrl} alt={design.namePl} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }} />
            {/* biome-ignore lint/performance/noImgElement: admin preview of the current catalogue photo, served straight from public/ */}
            <img src={design.previewUrl} alt={design.namePl} style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 4 }} />
          </Stack>
        )}
        <div>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {design === undefined ? ADMIN.designFieldThumbnailPl : ADMIN.designFieldThumbnailReplacePl}
          </Typography>
          <FileInputButton
            name="thumbnailFile"
            accept="image/jpeg,image/png,image/webp"
            required={design === undefined}
            label={design === undefined ? ADMIN.designFieldThumbnailPl : ADMIN.designFieldThumbnailReplacePl}
            chooseLabel={ADMIN.fileChoosePl}
          />
        </div>
        <div>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {design === undefined ? ADMIN.designFieldPreviewPl : ADMIN.designFieldPreviewReplacePl}
          </Typography>
          <FileInputButton
            name="previewFile"
            accept="image/jpeg,image/png,image/webp"
            required={design === undefined}
            label={design === undefined ? ADMIN.designFieldPreviewPl : ADMIN.designFieldPreviewReplacePl}
            chooseLabel={ADMIN.fileChoosePl}
          />
        </div>

        <Typography variant="subtitle1">{ADMIN.designSectionProductionPl}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldReferenceWidthPl}
              name="referenceWidthMm"
              defaultValue={fieldValue('referenceWidthMm', String(design?.referenceWidthMm ?? 300))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMinLineWidthPl}
              name="minLineWidthUm"
              defaultValue={fieldValue('minLineWidthUm', String(design?.minLineWidthUm ?? 1000))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMinDetailSpacingPl}
              name="minDetailSpacingUm"
              defaultValue={fieldValue('minDetailSpacingUm', String(design?.minDetailSpacingUm ?? 1000))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMinEngraveDepthPl}
              name="minEngraveDepthUm"
              defaultValue={fieldValue('minEngraveDepthUm', design?.minEngraveDepthUm !== null && design?.minEngraveDepthUm !== undefined ? String(design.minEngraveDepthUm) : '')}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              key={resetKey}
              fullWidth
              select
              label={ADMIN.designFieldRecommendedMethodPl}
              name="recommendedMethod"
              defaultValue={fieldValue('recommendedMethod', design?.recommendedMethod ?? PRODUCTION_METHODS[1])}
              size="small"
            >
              {PRODUCTION_METHODS.map((m) => (
                <MenuItem key={m} value={m}>
                  {adminProductionMethodLabel(m)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMinRecommendedWidthPl}
              name="minRecommendedWidthMm"
              defaultValue={fieldValue('minRecommendedWidthMm', String(design?.minRecommendedWidthMm ?? 100))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMaxRecommendedWidthPl}
              name="maxRecommendedWidthMm"
              defaultValue={fieldValue(
                'maxRecommendedWidthMm',
                design?.maxRecommendedWidthMm !== null && design?.maxRecommendedWidthMm !== undefined ? String(design.maxRecommendedWidthMm) : '',
              )}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldDetailLevelPl}
              name="detailLevel"
              defaultValue={fieldValue('detailLevel', String(design?.detailLevel ?? 3))}
              size="small"
              slotProps={{ htmlInput: { min: 1, max: 5 } }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldMachiningTimePl}
              name="machiningMilliMinutesPerM2"
              defaultValue={fieldValue('machiningMilliMinutesPerM2', String(design?.machiningMilliMinutesPerM2 ?? 2500))}
              size="small"
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle1">{ADMIN.designSectionRightsPl}</Typography>
        <TextField
          key={resetKey}
          select
          label={ADMIN.designFieldRightsStatusPl}
          name="rightsStatus"
          defaultValue={fieldValue('rightsStatus', design?.rightsStatus ?? 'REQUIRES_PERMISSION')}
          size="small"
          sx={{ maxWidth: 320 }}
        >
          {RIGHTS_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {adminDesignRightsStatusLabel(status)}
            </MenuItem>
          ))}
        </TextField>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.designFieldSourceArtistPl} name="sourceArtist" defaultValue={fieldValue('sourceArtist', design?.sourceArtist ?? '')} size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.designFieldSourceTitlePl} name="sourceTitle" defaultValue={fieldValue('sourceTitle', design?.sourceTitle ?? '')} size="small" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldSourceYearPl}
              name="sourceYear"
              defaultValue={fieldValue('sourceYear', design?.sourceYear !== null && design?.sourceYear !== undefined ? String(design.sourceYear) : '')}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.designFieldArtistDeathYearPl}
              name="artistDeathYear"
              defaultValue={fieldValue(
                'artistDeathYear',
                design?.artistDeathYear !== null && design?.artistDeathYear !== undefined ? String(design.artistDeathYear) : '',
              )}
              size="small"
            />
          </Grid>
        </Grid>
        <TextField label={ADMIN.designFieldSourceRefPl} name="sourceRef" defaultValue={fieldValue('sourceRef', design?.sourceRef ?? '')} size="small" />
        <TextField
          label={ADMIN.designFieldRightsNotesPl}
          name="rightsNotes"
          defaultValue={fieldValue('rightsNotes', design?.rightsNotes ?? '')}
          multiline
          minRows={2}
          size="small"
        />

        <TextField
          label={ADMIN.designFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={fieldValue('sortOrder', String(design?.sortOrder ?? 0))}
          size="small"
          sx={{ maxWidth: 200 }}
        />
        <FormControlLabel
          control={<Checkbox key={resetKey} name="featured" defaultChecked={fieldChecked('featured', design?.featured ?? false)} />}
          label={ADMIN.designFieldFeaturedPl}
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

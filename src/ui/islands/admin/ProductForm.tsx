'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminProductTypeLabel } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import type { AdminCategoryOption, AdminProductDetail } from '@/server/repositories/admin-products';
import { createProduct, updateProduct } from '@/server/actions/admin-products';
import type { ProductMutationResult } from '@/server/actions/admin-products';
import type { ProductTypeCode } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const PRODUCT_TYPES: readonly ProductTypeCode[] = [
  'WALL_ART',
  'TABLE_TOP',
  'KITCHEN_TILE',
  'FLOOR_ELEMENT',
  'CUSTOM',
  'LOFT_FURNITURE',
  'JEWELRY',
];

const INITIAL_STATE: ProductMutationResult = { ok: true, id: '' };

function grosze(formData: FormData, key: string): number {
  return Math.round(Number(formData.get(key) ?? 0) * 100);
}

export function ProductForm({
  product,
  categories,
}: {
  readonly product?: AdminProductDetail;
  readonly categories: readonly AdminCategoryOption[];
}) {
  const router = useRouter();
  const { capture, fieldValue, fieldChecked, resetKey } = usePreservedFormValues();

  const action = async (_prev: ProductMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      slug: String(formData.get('slug') ?? ''),
      typeCode: String(formData.get('typeCode') ?? '') as ProductTypeCode,
      categoryId: String(formData.get('categoryId') ?? ''),
      namePl: String(formData.get('namePl') ?? ''),
      shortDescPl: String(formData.get('shortDescPl') ?? ''),
      longDescPl: String(formData.get('longDescPl') ?? ''),
      careInstructionsPl: String(formData.get('careInstructionsPl') ?? ''),
      installationInfoPl: String(formData.get('installationInfoPl') ?? '').trim() || null,
      materialNotesPl: String(formData.get('materialNotesPl') ?? '').trim() || null,
      seoTitlePl: String(formData.get('seoTitlePl') ?? ''),
      seoDescPl: String(formData.get('seoDescPl') ?? ''),
      basePriceGrosze: grosze(formData, 'basePricePln'),
      minPriceGrosze: grosze(formData, 'minPricePln'),
      productionDaysMin: Number(formData.get('productionDaysMin') ?? 0),
      productionDaysMax: Number(formData.get('productionDaysMax') ?? 0),
      minWidthMm: Number(formData.get('minWidthMm') ?? 0),
      maxWidthMm: Number(formData.get('maxWidthMm') ?? 0),
      minHeightMm: Number(formData.get('minHeightMm') ?? 0),
      maxHeightMm: Number(formData.get('maxHeightMm') ?? 0),
      allowsCustomSize: formData.get('allowsCustomSize') === 'on',
      requiresExactSize: formData.get('requiresExactSize') === 'on',
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = product === undefined ? await createProduct(input) : await updateProduct(product.id, input);
    if (result.ok && product === undefined) {
      router.push(`/panel/produkty/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Typography variant="subtitle1">{ADMIN.productSectionCorePl}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.productFieldSlugPl} name="slug" defaultValue={fieldValue('slug', product?.slug)} required size="small" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              key={resetKey}
              fullWidth
              select
              label={ADMIN.productFieldTypeCodePl}
              name="typeCode"
              defaultValue={fieldValue('typeCode', product?.typeCode ?? PRODUCT_TYPES[0])}
              size="small"
            >
              {PRODUCT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {adminProductTypeLabel(t)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              key={resetKey}
              fullWidth
              select
              label={ADMIN.productFieldCategoryPl}
              name="categoryId"
              defaultValue={fieldValue('categoryId', product?.categoryId ?? categories[0]?.id ?? '')}
              size="small"
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.namePl}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={ADMIN.productFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', product?.namePl)} required size="small" />
          </Grid>
        </Grid>

        <TextField label={ADMIN.productFieldShortDescPl} name="shortDescPl" defaultValue={fieldValue('shortDescPl', product?.shortDescPl)} size="small" />
        <TextField
          label={ADMIN.productFieldLongDescPl}
          name="longDescPl"
          defaultValue={fieldValue('longDescPl', product?.longDescPl)}
          multiline
          minRows={3}
          size="small"
        />
        <TextField
          label={ADMIN.productFieldCareInstructionsPl}
          name="careInstructionsPl"
          defaultValue={fieldValue('careInstructionsPl', product?.careInstructionsPl)}
          multiline
          minRows={2}
          size="small"
        />
        <TextField
          label={ADMIN.productFieldInstallationInfoPl}
          name="installationInfoPl"
          defaultValue={fieldValue('installationInfoPl', product?.installationInfoPl ?? '')}
          multiline
          minRows={2}
          size="small"
        />
        <TextField label={ADMIN.productFieldMaterialNotesPl} name="materialNotesPl" defaultValue={fieldValue('materialNotesPl', product?.materialNotesPl ?? '')} size="small" />
        <TextField label={ADMIN.productFieldSeoTitlePl} name="seoTitlePl" defaultValue={fieldValue('seoTitlePl', product?.seoTitlePl)} size="small" />
        <TextField
          label={ADMIN.productFieldSeoDescPl}
          name="seoDescPl"
          defaultValue={fieldValue('seoDescPl', product?.seoDescPl)}
          multiline
          minRows={2}
          size="small"
        />

        <Typography variant="subtitle1">{ADMIN.productSectionDimensionsPl}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldBasePricePl}
              name="basePricePln"
              defaultValue={fieldValue('basePricePln', product !== undefined ? String(product.basePriceGrosze / 100) : '0')}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldMinPricePl}
              name="minPricePln"
              defaultValue={fieldValue('minPricePln', product !== undefined ? String(product.minPriceGrosze / 100) : '0')}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldProductionDaysMinPl}
              name="productionDaysMin"
              defaultValue={fieldValue('productionDaysMin', String(product?.productionDaysMin ?? 1))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldProductionDaysMaxPl}
              name="productionDaysMax"
              defaultValue={fieldValue('productionDaysMax', String(product?.productionDaysMax ?? 1))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldMinWidthPl}
              name="minWidthMm"
              defaultValue={fieldValue('minWidthMm', String(product?.minWidthMm ?? 100))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldMaxWidthPl}
              name="maxWidthMm"
              defaultValue={fieldValue('maxWidthMm', String(product?.maxWidthMm ?? 1000))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldMinHeightPl}
              name="minHeightMm"
              defaultValue={fieldValue('minHeightMm', String(product?.minHeightMm ?? 100))}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              fullWidth
              type="number"
              label={ADMIN.productFieldMaxHeightPl}
              name="maxHeightMm"
              defaultValue={fieldValue('maxHeightMm', String(product?.maxHeightMm ?? 1000))}
              size="small"
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={<Checkbox key={resetKey} name="allowsCustomSize" defaultChecked={fieldChecked('allowsCustomSize', product?.allowsCustomSize ?? true)} />}
          label={ADMIN.productFieldAllowsCustomSizePl}
        />
        <FormControlLabel
          control={<Checkbox key={resetKey} name="requiresExactSize" defaultChecked={fieldChecked('requiresExactSize', product?.requiresExactSize ?? false)} />}
          label={ADMIN.productFieldRequiresExactSizePl}
        />
        <TextField
          label={ADMIN.productFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={fieldValue('sortOrder', String(product?.sortOrder ?? 0))}
          size="small"
          sx={{ maxWidth: 200 }}
        />

        <SubmitButton />
        {product !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {formatPln(product.basePriceGrosze)} / {formatPln(product.minPriceGrosze)}
          </Typography>
        )}
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

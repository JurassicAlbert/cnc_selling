'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminInstallationVariantLabel } from '@/content/pl/admin';
import type { AdminInstallationVariant } from '@/server/repositories/admin-products';
import { addInstallationVariant, removeInstallationVariant } from '@/server/actions/admin-product-catalogue';
import type { ActionResult } from '@/server/actions/admin-product-catalogue';
import type { InstallationVariantCode } from '@/generated/prisma/enums';

const VARIANT_CODES: readonly InstallationVariantCode[] = ['ON_TOP', 'OVERLAY', 'REPLACEMENT'];
const INITIAL_STATE: ActionResult = { ok: true };

export function InstallVariantsEditor({
  productId,
  variants,
}: {
  readonly productId: string;
  readonly variants: readonly AdminInstallationVariant[];
}) {
  const action = async (_prev: ActionResult, formData: FormData) => {
    const maxThicknessRaw = String(formData.get('maxThicknessMm') ?? '').trim();
    return addInstallationVariant(productId, {
      code: String(formData.get('code') ?? '') as InstallationVariantCode,
      namePl: String(formData.get('namePl') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      receivesPl: String(formData.get('receivesPl') ?? ''),
      diagramUrl: String(formData.get('diagramUrl') ?? ''),
      maxThicknessMm: maxThicknessRaw.length > 0 ? Number(maxThicknessRaw) : null,
      priceFactorBp: Math.round(Number(formData.get('priceFactorPct') ?? 100) * 100),
      sortOrder: variants.length,
    });
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 640 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionInstallVariantsPl}</Typography>
      {variants.length === 0 && <Typography color="text.secondary">{ADMIN.installVariantsEmptyPl}</Typography>}
      {variants.map((variant) => (
        <Stack key={variant.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {variant.namePl} ({adminInstallationVariantLabel(variant.code)})
          </Typography>
          <form action={removeInstallationVariant.bind(null, productId, variant.id)}>
            <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
              ✕
            </IconButton>
          </form>
        </Stack>
      ))}

      <form action={formAction}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}
          <Stack direction="row" spacing={1}>
            <TextField select label={ADMIN.installVariantFieldCodePl} name="code" size="small" sx={{ width: 220 }} defaultValue={VARIANT_CODES[0]}>
              {VARIANT_CODES.map((code) => (
                <MenuItem key={code} value={code}>
                  {adminInstallationVariantLabel(code)}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={ADMIN.installVariantFieldNamePl} name="namePl" size="small" sx={{ flex: 1 }} />
          </Stack>
          <TextField label={ADMIN.installVariantFieldDescPl} name="descPl" size="small" multiline minRows={2} />
          <TextField label={ADMIN.installVariantFieldReceivesPl} name="receivesPl" size="small" multiline minRows={2} />
          <Stack direction="row" spacing={1}>
            <TextField label={ADMIN.installVariantFieldDiagramUrlPl} name="diagramUrl" size="small" sx={{ flex: 1 }} />
            <TextField label={ADMIN.installVariantFieldMaxThicknessPl} name="maxThicknessMm" type="number" size="small" sx={{ width: 160 }} />
            <TextField label={ADMIN.installVariantFieldPriceFactorPl} name="priceFactorPct" type="number" defaultValue={100} size="small" sx={{ width: 130 }} />
          </Stack>
          <SubmitButton />
        </Stack>
      </form>
    </Stack>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" size="small" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.addPl}
    </Button>
  );
}

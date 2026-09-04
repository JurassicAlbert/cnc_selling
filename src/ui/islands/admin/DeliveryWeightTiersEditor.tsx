'use client';

/**
 * The carrier rate-card editor - `docs/AUDIT-2026-08-30.md` §20.
 *
 * `DeliveryWeightTier` rows are what actually decide what a customer pays
 * for a tiered method, and until now the panel could not show them at all.
 * That made the delivery detail page worse than incomplete: it offered an
 * editable "Cena" that, for the InPost and DPD methods, is only a fallback
 * and is never charged - so an admin could change it, save, and see nothing
 * happen to the real price.
 *
 * Deliberately built on the same shape as `ThicknessesEditor` /
 * `PresetSizesEditor` (list rows with a remove form, one inline add form,
 * `useActionState` for the error) rather than as a new kind of editor -
 * §20's own "avoid several different CRUD implementations for the same type
 * of task".
 *
 * Units are converted at the boundary on purpose: staff think in kilograms
 * and złoty, the database stores grams and grosze, and every other admin
 * form in this project does the same conversion in the same place.
 */

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import type { AdminDeliveryWeightTier } from '@/server/repositories/admin-delivery-methods';
import { addDeliveryWeightTier, removeDeliveryWeightTier } from '@/server/actions/admin-delivery-methods';
import type { DeliveryMethodMutationResult } from '@/server/actions/admin-delivery-methods';

const INITIAL_STATE: DeliveryMethodMutationResult = { ok: true, id: '' };

/** `''` (an untouched optional dimension field) must mean "no limit", not 0 - 0 would be a limit nothing can satisfy. */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  return raw.length === 0 ? null : Number(raw);
}

function dimensionSummary(tier: AdminDeliveryWeightTier): string {
  const parts = [tier.maxWidthMm, tier.maxHeightMm, tier.maxDepthMm];
  if (parts.every((part) => part === null)) {
    return ADMIN.deliveryTierNoDimensionLimitPl;
  }
  return `${parts.map((part) => (part === null ? '-' : `${part}`)).join(' × ')} mm`;
}

export function DeliveryWeightTiersEditor({
  deliveryMethodId,
  tiers,
}: {
  readonly deliveryMethodId: string;
  readonly tiers: readonly AdminDeliveryWeightTier[];
}) {
  const action = async (_prev: DeliveryMethodMutationResult, formData: FormData) =>
    addDeliveryWeightTier(deliveryMethodId, {
      labelPl: String(formData.get('labelPl') ?? ''),
      // Kilograms in the form, grams in the database. `Math.round` because
      // 2.4 kg must not become 2399.9999 g.
      maxWeightGrams: Math.round(Number(formData.get('maxWeightKg') ?? 0) * 1000),
      priceGrosze: Math.round(Number(formData.get('pricePln') ?? 0) * 100),
      maxWidthMm: optionalNumber(formData.get('maxWidthMm')),
      maxHeightMm: optionalNumber(formData.get('maxHeightMm')),
      maxDepthMm: optionalNumber(formData.get('maxDepthMm')),
    });
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mt: 3, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {ADMIN.deliveryTiersHeadingPl}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ADMIN.deliveryTiersIntroPl}
          </Typography>
        </Stack>

        {tiers.length === 0 ? (
          <Alert severity="info" variant="outlined">
            {ADMIN.deliveryTiersEmptyPl}
          </Alert>
        ) : (
          <Stack spacing={1}>
            {tiers.map((tier) => (
              <Stack
                key={tier.id}
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', pb: 1 }}
              >
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                  {tier.labelPl}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ width: 90 }}>
                  {(tier.maxWeightGrams / 1000).toFixed(2)} kg
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {dimensionSummary(tier)}
                </Typography>
                <Typography variant="body2" sx={{ width: 90, textAlign: 'right', fontWeight: 600 }}>
                  {formatPln(tier.priceGrosze)}
                </Typography>
                <form action={removeDeliveryWeightTier.bind(null, deliveryMethodId, tier.id)}>
                  <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
                    ✕
                  </IconButton>
                </form>
              </Stack>
            ))}
          </Stack>
        )}

        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <form action={formAction}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <TextField label={ADMIN.deliveryTierFieldLabelPl} name="labelPl" size="small" sx={{ width: 180 }} />
              <TextField
                label={ADMIN.deliveryTierFieldMaxWeightKgPl}
                name="maxWeightKg"
                type="number"
                slotProps={{ htmlInput: { step: '0.1', min: '0.1' } }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label={ADMIN.deliveryTierFieldPricePlnPl}
                name="pricePln"
                type="number"
                slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField label={ADMIN.deliveryTierFieldMaxWidthMmPl} name="maxWidthMm" type="number" size="small" sx={{ width: 140 }} />
              <TextField label={ADMIN.deliveryTierFieldMaxHeightMmPl} name="maxHeightMm" type="number" size="small" sx={{ width: 140 }} />
              <TextField label={ADMIN.deliveryTierFieldMaxDepthMmPl} name="maxDepthMm" type="number" size="small" sx={{ width: 140 }} />
              <SubmitButton />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {ADMIN.deliveryTierDimensionsHelperPl}
            </Typography>
          </Stack>
        </form>
      </Stack>
    </Paper>
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

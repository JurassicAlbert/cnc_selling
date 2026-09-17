'use client';

/**
 * The carrier's declared-value rate card - INSURANCE-01.
 *
 * This screen is what the item was blocked on. The owner chose the carrier's
 * real table over a flat fee or a percentage, and neither InPost nor DPD
 * publishes one citably, so no band could be seeded without inventing a
 * number - the same wall `Kurier GEIS` hit for its weight tiers
 * (`docs/OPEN_ITEMS.md` §2 and §10). The mechanism ships empty and turns
 * itself on the moment real bands are typed in here: `resolveDeliveryMethodsForCart`
 * derives the offer from these rows, so nothing in checkout or order creation
 * has to change.
 *
 * Deliberately the same shape as `DeliveryWeightTiersEditor` beside it (list
 * rows with a remove form, one inline add form, `useActionState` for the
 * error) rather than a new kind of editor - `docs/AUDIT-2026-08-30.md` §20's
 * own "avoid several different CRUD implementations for the same type of
 * task".
 *
 * Złoty in the form, grosze in the database, converted at the boundary, like
 * every other admin form here.
 */

import { Alert, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { addDeliveryInsuranceTier, removeDeliveryInsuranceTier } from '@/server/actions/admin-delivery-methods';
import type { DeliveryMethodMutationResult } from '@/server/actions/admin-delivery-methods';
import type { AdminDeliveryInsuranceTier } from '@/server/repositories/admin-delivery-methods';

const INITIAL_STATE: DeliveryMethodMutationResult = { ok: true, id: '' };

export function DeliveryInsuranceTiersEditor({
  deliveryMethodId,
  tiers,
}: {
  readonly deliveryMethodId: string;
  readonly tiers: readonly AdminDeliveryInsuranceTier[];
}) {
  const action = async (_prev: DeliveryMethodMutationResult, formData: FormData) =>
    addDeliveryInsuranceTier(deliveryMethodId, {
      labelPl: String(formData.get('labelPl') ?? ''),
      // Złoty in the form, grosze in the database. `Math.round` because
      // 1000.00 zł must not become 99 999.99 gr.
      maxValueGrosze: Math.round(Number(formData.get('maxValuePln') ?? 0) * 100),
      priceGrosze: Math.round(Number(formData.get('pricePln') ?? 0) * 100),
    });
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mt: 3, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {ADMIN.deliveryInsuranceHeadingPl}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ADMIN.deliveryInsuranceIntroPl}
          </Typography>
        </Stack>

        {tiers.length === 0 ? (
          <Alert severity="info" variant="outlined">
            {ADMIN.deliveryInsuranceEmptyPl}
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
                <Typography variant="body2" color="text.secondary" sx={{ width: 120, textAlign: 'right' }}>
                  {formatPln(tier.maxValueGrosze)}
                </Typography>
                <Typography variant="body2" sx={{ width: 100, textAlign: 'right', fontWeight: 600 }}>
                  {formatPln(tier.priceGrosze)}
                </Typography>
                <form action={removeDeliveryInsuranceTier.bind(null, deliveryMethodId, tier.id)}>
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
              <TextField label={ADMIN.deliveryInsuranceFieldLabelPl} name="labelPl" size="small" sx={{ width: 200 }} />
              <TextField
                label={ADMIN.deliveryInsuranceFieldMaxValuePlnPl}
                name="maxValuePln"
                type="number"
                slotProps={{ htmlInput: { step: '0.01', min: '0.01' } }}
                size="small"
                sx={{ width: 150 }}
              />
              <TextField
                label={ADMIN.deliveryInsuranceFieldPricePlnPl}
                name="pricePln"
                type="number"
                slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                size="small"
                sx={{ width: 150 }}
              />
              <SubmitButton />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {ADMIN.deliveryInsuranceHelperPl}
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

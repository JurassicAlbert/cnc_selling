'use client';

/**
 * Creates a new `PricingSettings` DRAFT — never edits an existing version
 * (`docs/ARCHITECTURE.md` §16A.1 module 7). Prefilled from the currently
 * active version so the admin edits deltas, not blank fields. On success,
 * navigates straight to the new draft's detail page (`/panel/ceny/[version]`)
 * where the simulator lives — a draft is inert until published from there.
 */

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Divider, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';

import { ADMIN } from '@/content/pl/admin';
import { createPricingDraft } from '@/server/actions/admin-pricing';
import type { PackagingTierInput, PricingDraftResult } from '@/server/actions/admin-pricing';
import type { AdminPricingVersion } from '@/server/repositories/admin-pricing';
import { DisabledExplanation } from '@/ui/primitives/DisabledExplanation';

const INITIAL_STATE: PricingDraftResult = { ok: true, version: 0 };

function toPln(grosze: number): number {
  return grosze / 100;
}

function toGrosze(value: FormDataEntryValue | null): number {
  return Math.round(Number(value ?? 0) * 100);
}

let tierKeySeq = 0;
function newTierKey(): number {
  tierKeySeq += 1;
  return tierKeySeq;
}

export function PricingDraftForm({ active }: { readonly active: AdminPricingVersion }) {
  const router = useRouter();
  const seedTiers = (Array.isArray(active.packagingTiers) ? active.packagingTiers : []) as PackagingTierInput[];
  const [tiers, setTiers] = useState<readonly { readonly key: number; readonly tier: PackagingTierInput }[]>(
    seedTiers.map((tier) => ({ key: newTierKey(), tier })),
  );

  const action = async (_prev: PricingDraftResult, formData: FormData): Promise<PricingDraftResult> => {
    const packagingTiers = tiers.map(({ key }) => ({
      maxAreaM2: toOptionalNumber(formData.get(`tierMaxAreaM2-${key}`)),
      maxModules: toOptionalNumber(formData.get(`tierMaxModules-${key}`)),
      priceGrosze: toGrosze(formData.get(`tierPricePln-${key}`)),
    }));

    const result = await createPricingDraft({
      machineRateCncGrosze: toGrosze(formData.get('machineRateCncPln')),
      machineRateLaserGrosze: toGrosze(formData.get('machineRateLaserPln')),
      moduleSurchargeGrosze: toGrosze(formData.get('moduleSurchargePln')),
      vatRateBp: Math.round(Number(formData.get('vatRatePercent') ?? 0) * 100),
      packagingTiers,
      notePl: String(formData.get('notePl') ?? ''),
    });
    if (result.ok) {
      router.push(`/panel/ceny/${result.version}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField
          label={ADMIN.pricingFieldMachineRateCncPl}
          name="machineRateCncPln"
          type="number"
          defaultValue={toPln(active.machineRateCncGrosze)}
          size="small"
          slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
        />
        <TextField
          label={ADMIN.pricingFieldMachineRateLaserPl}
          name="machineRateLaserPln"
          type="number"
          defaultValue={toPln(active.machineRateLaserGrosze)}
          size="small"
          slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
        />
        <TextField
          label={ADMIN.pricingFieldModuleSurchargePl}
          name="moduleSurchargePln"
          type="number"
          defaultValue={toPln(active.moduleSurchargeGrosze)}
          size="small"
          slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
        />
        <TextField
          label={ADMIN.pricingFieldVatRatePl}
          name="vatRatePercent"
          type="number"
          defaultValue={active.vatRateBp / 100}
          size="small"
          sx={{ maxWidth: 200 }}
          slotProps={{ htmlInput: { step: '0.01', min: 0, max: 100 } }}
        />

        <Divider />
        <Typography variant="subtitle1">{ADMIN.pricingPackagingTiersHeadingPl}</Typography>
        <Typography variant="body2" color="text.secondary">
          {ADMIN.pricingPackagingTiersHintPl}
        </Typography>

        {tiers.map(({ key, tier }, index) => (
          <Stack key={key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              label={ADMIN.pricingFieldTierMaxAreaPl}
              name={`tierMaxAreaM2-${key}`}
              type="number"
              defaultValue={tier.maxAreaM2 ?? ''}
              placeholder={index === tiers.length - 1 ? ADMIN.pricingTierNoLimitPl : undefined}
              size="small"
              slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
              sx={{ width: 160 }}
            />
            <TextField
              label={ADMIN.pricingFieldTierMaxModulesPl}
              name={`tierMaxModules-${key}`}
              type="number"
              defaultValue={tier.maxModules ?? ''}
              placeholder={index === tiers.length - 1 ? ADMIN.pricingTierNoLimitPl : undefined}
              size="small"
              slotProps={{ htmlInput: { step: '1', min: 0 } }}
              sx={{ width: 160 }}
            />
            <TextField
              label={ADMIN.pricingFieldTierPricePl}
              name={`tierPricePln-${key}`}
              type="number"
              defaultValue={toPln(tier.priceGrosze)}
              required
              size="small"
              slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
              sx={{ width: 140 }}
            />
            <DisabledExplanation title={tiers.length <= 1 ? ADMIN.pricingRemoveTierBlockedPl : undefined}>
              <IconButton
                aria-label={ADMIN.pricingRemoveTierPl}
                size="small"
                disabled={tiers.length <= 1}
                onClick={() => setTiers((prev) => prev.filter((t) => t.key !== key))}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </DisabledExplanation>
          </Stack>
        ))}
        <Button
          type="button"
          startIcon={<AddIcon />}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
          onClick={() => setTiers((prev) => [...prev, { key: newTierKey(), tier: { maxAreaM2: null, maxModules: null, priceGrosze: 0 } }])}
        >
          {ADMIN.pricingAddTierPl}
        </Button>

        <Divider />
        <TextField label={ADMIN.pricingFieldNotePl} name="notePl" multiline minRows={2} size="small" />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function toOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim().length === 0) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.pricingSaveDraftPl}
    </Button>
  );
}

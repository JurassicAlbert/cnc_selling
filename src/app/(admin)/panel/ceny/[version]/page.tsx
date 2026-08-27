import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Grid, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { requireAdminSession } from '@/server/auth/session';
import { getPricingVersionByNumber } from '@/server/repositories/admin-pricing';
import { PricingSimulator } from '@/ui/islands/admin/PricingSimulator';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type PricingVersionPageProps = {
  readonly params: Promise<{ readonly version: string }>;
};

export default async function AdminPricingVersionPage({ params }: PricingVersionPageProps) {
  await requireAdminSession();
  const { version: versionParam } = await params;
  const version = Number(versionParam);
  if (!Number.isInteger(version)) {
    notFound();
  }

  const row = await getPricingVersionByNumber(version);
  if (row === null) {
    notFound();
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {ADMIN.pricingHeadingPl} — #{row.version}
      </Typography>
      <Link href="/panel/ceny">{ADMIN.pricingBackToListPl}</Link>

      <Grid container spacing={2} sx={{ mt: 2, mb: 2, maxWidth: 640 }}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            {ADMIN.pricingFieldMachineRateCncPl}
          </Typography>
          <Typography>{formatPln(row.machineRateCncGrosze)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            {ADMIN.pricingFieldMachineRateLaserPl}
          </Typography>
          <Typography>{formatPln(row.machineRateLaserGrosze)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            {ADMIN.pricingFieldModuleSurchargePl}
          </Typography>
          <Typography>{formatPln(row.moduleSurchargeGrosze)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            {ADMIN.pricingFieldVatRatePl}
          </Typography>
          <Typography>{row.vatRateBp / 100}%</Typography>
        </Grid>
      </Grid>

      {row.notePl !== null && (
        <Stack sx={{ mb: 2, maxWidth: 640 }}>
          <Typography variant="caption" color="text.secondary">
            {ADMIN.pricingFieldNotePl}
          </Typography>
          <Typography>{row.notePl}</Typography>
        </Stack>
      )}

      <Typography variant="subtitle1">{ADMIN.pricingPackagingTiersHeadingPl}</Typography>
      <PackagingTiersReadout tiers={row.packagingTiers} />

      <PricingSimulator version={row.version} alreadyActive={row.isActive} />
      <RecordActivityTimeline entity="PricingSettings" entityId={String(row.version)} />
    </>
  );
}

function PackagingTiersReadout({ tiers }: { readonly tiers: unknown }) {
  if (!Array.isArray(tiers)) {
    return null;
  }
  return (
    <Stack spacing={0.5} sx={{ mb: 2 }}>
      {tiers.map((tier: { readonly maxAreaM2: number | null; readonly maxModules: number | null; readonly priceGrosze: number }, i: number) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: this list is a fixed, ordered, immutable snapshot of one pricing version's JSON — it never reorders or changes after being read
        <Typography key={i} variant="body2" color="text.secondary">
          {tier.maxAreaM2 ?? ADMIN.pricingTierNoLimitPl} m² / {tier.maxModules ?? ADMIN.pricingTierNoLimitPl} mod. → {formatPln(tier.priceGrosze)}
        </Typography>
      ))}
    </Stack>
  );
}

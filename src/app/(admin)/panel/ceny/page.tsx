import Link from 'next/link';
import { Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { requireAdminSession } from '@/server/auth/session';
import { getActivePricingVersion, listPricingVersions } from '@/server/repositories/admin-pricing';
import { PricingDraftForm } from '@/ui/islands/admin/PricingDraftForm';

function statusChip(version: { readonly isActive: boolean; readonly publishedAt: Date | null }) {
  if (version.isActive) {
    return <Chip size="small" color="success" label={ADMIN.pricingStatusActivePl} />;
  }
  if (version.publishedAt !== null) {
    return <Chip size="small" color="default" label={ADMIN.pricingStatusArchivedPl} />;
  }
  return <Chip size="small" color="warning" label={ADMIN.pricingStatusDraftPl} />;
}

export default async function AdminPricingPage() {
  await requireAdminSession();
  const [versions, active] = await Promise.all([listPricingVersions(), getActivePricingVersion()]);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {ADMIN.pricingHeadingPl}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        {ADMIN.pricingIntroPl}
      </Typography>

      <Table size="small" sx={{ mb: 4, maxWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell>{ADMIN.pricingColumnVersionPl}</TableCell>
            <TableCell>{ADMIN.pricingColumnStatusPl}</TableCell>
            <TableCell>{ADMIN.pricingColumnPublishedPl}</TableCell>
            <TableCell>{ADMIN.pricingColumnNotePl}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {versions.map((v) => (
            <TableRow key={v.version} hover>
              <TableCell>
                <Link href={`/panel/ceny/${v.version}`}>#{v.version}</Link>
              </TableCell>
              <TableCell>{statusChip(v)}</TableCell>
              <TableCell>
                {v.publishedAt === null
                  ? '—'
                  : `${v.publishedAt.toLocaleDateString('pl-PL')} (${v.publishedByEmail ?? '—'})`}
              </TableCell>
              <TableCell>{v.notePl ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {active !== null && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            {ADMIN.pricingActiveVersionLabelPl}: #{active.version} — {ADMIN.pricingFieldMachineRateCncPl} {formatPln(active.machineRateCncGrosze)}
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            {ADMIN.pricingNewDraftHeadingPl}
          </Typography>
          <PricingDraftForm active={active} />
        </>
      )}
    </>
  );
}

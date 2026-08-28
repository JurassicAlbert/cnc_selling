import Link from 'next/link';
import { Divider, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { countPrunableAnalyticsEvents } from '@/server/analytics/prune';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { AnalyticsPruneControl } from '@/ui/islands/admin/AnalyticsPruneControl';
import { StoreSettingsForm } from '@/ui/islands/admin/StoreSettingsForm';

export default async function AdminSettingsPage() {
  const [settings, prunableCount] = await Promise.all([getStoreSettings(), countPrunableAnalyticsEvents()]);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.settingsHeadingPl}
      </Typography>

      <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
        <Link href="/panel/ustawienia/personel">{ADMIN.settingsPersonnelLinkPl}</Link>
        <Link href="/panel/ustawienia/szablony">{ADMIN.settingsEmailTemplatesLinkPl}</Link>
      </Stack>

      <Typography variant="h6" sx={{ mb: 2 }}>
        {ADMIN.settingsStoreSectionHeadingPl}
      </Typography>
      <StoreSettingsForm settings={settings} />

      <Divider sx={{ my: 4, maxWidth: 480 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        {ADMIN.settingsAnalyticsSectionHeadingPl}
      </Typography>
      <AnalyticsPruneControl initialPrunableCount={prunableCount} />
    </>
  );
}

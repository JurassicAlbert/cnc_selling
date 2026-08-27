import Link from 'next/link';
import { Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { StoreSettingsForm } from '@/ui/islands/admin/StoreSettingsForm';

export default async function AdminSettingsPage() {
  const settings = await getStoreSettings();

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
    </>
  );
}

import Link from 'next/link';
import { Divider, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { requireAdminSession } from '@/server/auth/session';
import { countPrunableAnalyticsEvents } from '@/server/analytics/prune';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { AnalyticsPruneControl } from '@/ui/islands/admin/AnalyticsPruneControl';
import { StoreSettingsForm } from '@/ui/islands/admin/StoreSettingsForm';

/**
 * ADMIN-only, 2026-08-31 (docs/REVIEW-DETAILED.md SEC-04). Everything on
 * this screen is: the bank account every bank-transfer customer is told to
 * pay into, and analytics pruning (already ADMIN at the operation level).
 * ARCHITECTURE.md §16.3 assigns settings to ADMIN, and a page that renders
 * a form its own action will refuse is the shape the owner ruled out on
 * 2026-08-31 — "there shouldn't be cases where we allow something but its
 * blocked by system". `AdminSidebarNav` hides the link for STAFF for the
 * same reason; this is the gate that actually enforces it.
 */
export default async function AdminSettingsPage() {
  await requireAdminSession();
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

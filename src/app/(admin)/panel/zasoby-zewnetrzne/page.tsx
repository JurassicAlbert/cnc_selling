import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listExternalPatternResourcesForAdmin } from '@/server/repositories/admin-external-pattern-resources';
import { ExternalPatternResourceDataGrid } from '@/ui/islands/admin/ExternalPatternResourceDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminExternalPatternResourcesPage() {
  const resources = await listExternalPatternResourcesForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.externalPatternResourcesHeadingPl}
        <Link href="/panel/zasoby-zewnetrzne/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.externalPatternResourcesNewPl}
          </Button>
        </Link>
      </Typography>

      {resources.length === 0 ? (
        <EmptyState message={ADMIN.externalPatternResourcesEmptyPl} actionLabel={ADMIN.externalPatternResourcesNewPl} actionHref="/panel/zasoby-zewnetrzne/nowy" />
      ) : (
        <ExternalPatternResourceDataGrid rows={resources} />
      )}
    </>
  );
}

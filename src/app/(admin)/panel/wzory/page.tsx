import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listDesignsForAdmin } from '@/server/repositories/admin-designs';
import { DesignsDataGrid } from '@/ui/islands/admin/DesignsDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminDesignsPage() {
  const designs = await listDesignsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.designsHeadingPl}
        <Link href="/panel/wzory/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.designsNewPl}
          </Button>
        </Link>
      </Typography>

      {designs.length === 0 ? (
        <EmptyState message={ADMIN.designsEmptyPl} actionLabel={ADMIN.designsNewPl} actionHref="/panel/wzory/nowy" />
      ) : (
        <DesignsDataGrid rows={designs} />
      )}
    </>
  );
}

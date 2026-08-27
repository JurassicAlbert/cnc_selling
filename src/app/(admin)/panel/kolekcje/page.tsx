import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCollectionsForAdmin } from '@/server/repositories/admin-designs';
import { CollectionsDataGrid } from '@/ui/islands/admin/CollectionsDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminCollectionsPage() {
  const collections = await listCollectionsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.collectionsHeadingPl}
        <Link href="/panel/kolekcje/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.collectionsNewPl}
          </Button>
        </Link>
      </Typography>

      {collections.length === 0 ? (
        <EmptyState message={ADMIN.collectionsEmptyPl} actionLabel={ADMIN.collectionsNewPl} actionHref="/panel/kolekcje/nowa" />
      ) : (
        <CollectionsDataGrid rows={collections} />
      )}
    </>
  );
}

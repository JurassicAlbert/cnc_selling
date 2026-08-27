import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCollectionsForAdmin } from '@/server/repositories/admin-designs';
import { CollectionsDataGrid } from '@/ui/islands/admin/CollectionsDataGrid';

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
        <Typography color="text.secondary">{ADMIN.collectionsEmptyPl}</Typography>
      ) : (
        <CollectionsDataGrid rows={collections} />
      )}
    </>
  );
}

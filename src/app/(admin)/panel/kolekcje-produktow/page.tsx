import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listProductCollectionsForAdmin } from '@/server/repositories/admin-product-collections';
import { ProductCollectionDataGrid } from '@/ui/islands/admin/ProductCollectionDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminProductCollectionsPage() {
  const collections = await listProductCollectionsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.productCollectionsHeadingPl}
        <Link href="/panel/kolekcje-produktow/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.productCollectionsNewPl}
          </Button>
        </Link>
      </Typography>

      {collections.length === 0 ? (
        <EmptyState message={ADMIN.productCollectionsEmptyPl} actionLabel={ADMIN.productCollectionsNewPl} actionHref="/panel/kolekcje-produktow/nowa" />
      ) : (
        <ProductCollectionDataGrid rows={collections} />
      )}
    </>
  );
}

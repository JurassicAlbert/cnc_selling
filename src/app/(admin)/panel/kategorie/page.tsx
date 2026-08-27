import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCategoriesForAdmin } from '@/server/repositories/admin-categories';
import { CategoriesDataGrid } from '@/ui/islands/admin/CategoriesDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminCategoriesPage() {
  const categories = await listCategoriesForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.categoriesHeadingPl}
        <Link href="/panel/kategorie/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.categoriesNewPl}
          </Button>
        </Link>
      </Typography>

      {categories.length === 0 ? (
        <EmptyState message={ADMIN.categoriesEmptyPl} actionLabel={ADMIN.categoriesNewPl} actionHref="/panel/kategorie/nowa" />
      ) : (
        <CategoriesDataGrid rows={categories} />
      )}
    </>
  );
}

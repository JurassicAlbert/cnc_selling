import Link from 'next/link';
import { Button, Divider, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { importCategoriesFromCsv } from '@/server/actions/admin-categories';
import { listCategoriesForAdmin } from '@/server/repositories/admin-categories';
import { CategoriesDataGrid } from '@/ui/islands/admin/CategoriesDataGrid';
import { CsvImportForm } from '@/ui/islands/admin/CsvImportForm';
import { EmptyState } from '@/ui/primitives/EmptyState';

const CSV_COLUMNS = ['slug', 'namePl', 'descPl', 'seoTitlePl', 'seoDescPl', 'imageUrl', 'sortOrder'] as const;

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

      <Divider sx={{ my: 4 }} />
      <CsvImportForm action={importCategoriesFromCsv} expectedColumns={CSV_COLUMNS} />
    </>
  );
}

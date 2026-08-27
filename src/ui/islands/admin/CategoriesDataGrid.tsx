'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { setCategoryActive, setCategorySortOrder } from '@/server/actions/admin-categories';
import type { AdminCategoryListItem } from '@/server/repositories/admin-categories';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function CategoriesDataGrid({ rows }: { readonly rows: readonly AdminCategoryListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminCategoryListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.categoriesColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/kategorie/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'slug', headerName: ADMIN.categoriesColumnSlugPl, flex: 1, minWidth: 160 },
    {
      field: 'productCount',
      headerName: ADMIN.categoriesColumnProductsPl,
      flex: 0.6,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'sortOrder',
      headerName: ADMIN.categoryFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isActive',
      headerName: ADMIN.categoriesColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setCategoryActive(params.row.id, e.target.checked);
            router.refresh();
          }}
        />
      ),
    },
  ];

  return (
    <EntityDataGrid
      rows={rows}
      columns={columns}
      basePath="/panel/kategorie"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setCategorySortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[CategoriesDataGrid] row update failed:', error)}
    />
  );
}

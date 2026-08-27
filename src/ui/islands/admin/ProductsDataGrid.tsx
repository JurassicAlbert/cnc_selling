'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { setProductActive, setProductSortOrder } from '@/server/actions/admin-products';
import type { AdminProductListItem } from '@/server/repositories/admin-products';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function ProductsDataGrid({ rows }: { readonly rows: readonly AdminProductListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminProductListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.productsColumnNamePl,
      flex: 1.4,
      minWidth: 200,
      renderCell: (params) => (
        <Link href={`/panel/produkty/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'slug', headerName: ADMIN.productsColumnSlugPl, flex: 1, minWidth: 160 },
    { field: 'categoryNamePl', headerName: ADMIN.productsColumnCategoryPl, flex: 1, minWidth: 160 },
    {
      field: 'sortOrder',
      headerName: ADMIN.productFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isActive',
      headerName: ADMIN.productsColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setProductActive(params.row.id, e.target.checked);
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
      basePath="/panel/produkty"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setProductSortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[ProductsDataGrid] row update failed:', error)}
    />
  );
}

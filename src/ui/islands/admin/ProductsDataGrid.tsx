'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { AdminProductListItem } from '@/server/repositories/admin-products';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function ProductsDataGrid({ rows }: { readonly rows: readonly AdminProductListItem[] }) {
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
      field: 'isActive',
      headerName: ADMIN.productsColumnStatusPl,
      flex: 0.7,
      minWidth: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl}
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
  ];

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/produkty" />;
}

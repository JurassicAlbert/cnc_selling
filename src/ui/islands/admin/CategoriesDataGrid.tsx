'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { AdminCategoryListItem } from '@/server/repositories/admin-categories';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function CategoriesDataGrid({ rows }: { readonly rows: readonly AdminCategoryListItem[] }) {
  const columns: GridColDef<AdminCategoryListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.categoriesColumnNamePl,
      flex: 1.2,
      minWidth: 180,
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
      field: 'isActive',
      headerName: ADMIN.categoriesColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/kategorie" />;
}

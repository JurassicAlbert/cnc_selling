'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { AdminStaticPageListItem } from '@/server/repositories/admin-static-pages';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function StaticPagesDataGrid({ rows }: { readonly rows: readonly AdminStaticPageListItem[] }) {
  const columns: GridColDef<AdminStaticPageListItem>[] = [
    {
      field: 'titlePl',
      headerName: ADMIN.staticPagesColumnTitlePl,
      flex: 1.2,
      minWidth: 200,
      renderCell: (params) => (
        <Link href={`/panel/strony/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'slug', headerName: ADMIN.staticPagesColumnSlugPl, flex: 1, minWidth: 160 },
    {
      field: 'isActive',
      headerName: ADMIN.staticPagesColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/strony" />;
}

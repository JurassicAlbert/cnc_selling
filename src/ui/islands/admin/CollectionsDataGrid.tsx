'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { AdminCollectionListItem } from '@/server/repositories/admin-designs';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function CollectionsDataGrid({ rows }: { readonly rows: readonly AdminCollectionListItem[] }) {
  const columns: GridColDef<AdminCollectionListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.collectionsColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Link href={`/panel/kolekcje/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'designCount',
      headerName: ADMIN.collectionsColumnDesignsPl,
      flex: 0.6,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'isActive',
      headerName: ADMIN.collectionsColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/kolekcje" />;
}

'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminFinishKindLabel } from '@/content/pl/admin';
import type { AdminFinishListItem } from '@/server/repositories/admin-finishes';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function FinishesDataGrid({ rows }: { readonly rows: readonly AdminFinishListItem[] }) {
  const columns: GridColDef<AdminFinishListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.finishesColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Link href={`/panel/wykonczenia/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'kind',
      headerName: ADMIN.finishesColumnKindPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: AdminFinishListItem['kind']) => adminFinishKindLabel(value),
    },
    {
      field: 'isAvailable',
      headerName: ADMIN.finishesColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/wykonczenia" />;
}

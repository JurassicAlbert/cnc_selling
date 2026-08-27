'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminMaterialFamilyLabel } from '@/content/pl/admin';
import type { AdminMaterialListItem } from '@/server/repositories/admin-materials';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function MaterialsDataGrid({ rows }: { readonly rows: readonly AdminMaterialListItem[] }) {
  const columns: GridColDef<AdminMaterialListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.materialsColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Link href={`/panel/materialy/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'family',
      headerName: ADMIN.materialsColumnFamilyPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: AdminMaterialListItem['family']) => adminMaterialFamilyLabel(value),
    },
    {
      field: 'isAvailable',
      headerName: ADMIN.materialsColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/materialy" />;
}

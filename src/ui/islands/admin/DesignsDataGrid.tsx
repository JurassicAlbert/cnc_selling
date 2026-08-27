'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminDesignRightsStatusLabel } from '@/content/pl/admin';
import type { AdminDesignListItem } from '@/server/repositories/admin-designs';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

const SELLABLE_RIGHTS = new Set(['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN']);

export function DesignsDataGrid({ rows }: { readonly rows: readonly AdminDesignListItem[] }) {
  const columns: GridColDef<AdminDesignListItem>[] = [
    {
      field: 'code',
      headerName: ADMIN.designsColumnCodePl,
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) => (
        <Link href={`/panel/wzory/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'namePl', headerName: ADMIN.designsColumnNamePl, flex: 1.2, minWidth: 180 },
    {
      field: 'rightsStatus',
      headerName: ADMIN.designsColumnRightsPl,
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Chip
          size="small"
          label={adminDesignRightsStatusLabel(params.value)}
          color={SELLABLE_RIGHTS.has(params.value) ? 'success' : 'warning'}
        />
      ),
    },
    {
      field: 'isActive',
      headerName: ADMIN.designsColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/wzory" />;
}

'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminExternalPatternResourceListItem } from '@/server/repositories/admin-external-pattern-resources';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function ExternalPatternResourceDataGrid({ rows }: { readonly rows: readonly AdminExternalPatternResourceListItem[] }) {
  const columns: GridColDef<AdminExternalPatternResourceListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.externalPatternResourcesColumnNamePl,
      flex: 2,
      minWidth: 220,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/zasoby-zewnetrzne/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'sourceLabel',
      headerName: ADMIN.externalPatternResourcesColumnSourcePl,
      flex: 1,
      minWidth: 160,
      sortComparator: comparePl,
    },
    {
      field: 'isActive',
      headerName: ADMIN.externalPatternResourcesColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/zasoby-zewnetrzne" />;
}

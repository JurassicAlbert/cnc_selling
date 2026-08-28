'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminProductCollectionListItem } from '@/server/repositories/admin-product-collections';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function ProductCollectionDataGrid({ rows }: { readonly rows: readonly AdminProductCollectionListItem[] }) {
  const columns: GridColDef<AdminProductCollectionListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.productCollectionColumnNamePl,
      flex: 2,
      minWidth: 220,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/kolekcje-produktow/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'productCount',
      headerName: ADMIN.productCollectionColumnProductCountPl,
      flex: 0.6,
      minWidth: 120,
    },
    {
      field: 'isActive',
      headerName: ADMIN.productCollectionColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/kolekcje-produktow" />;
}

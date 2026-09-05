'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { formatPln } from '@/domain/money/money';
import type { AdminDeliveryMethodListItem } from '@/server/repositories/admin-delivery-methods';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function DeliveryMethodDataGrid({ rows }: { readonly rows: readonly AdminDeliveryMethodListItem[] }) {
  const columns: GridColDef<AdminDeliveryMethodListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.deliveryMethodColumnNamePl,
      flex: 2,
      minWidth: 220,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/dostawa/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'priceGrosze',
      headerName: ADMIN.deliveryMethodColumnPricePl,
      flex: 0.8,
      minWidth: 130,
      valueFormatter: (value: number) => formatPln(value),
    },
    {
      field: 'isActive',
      headerName: ADMIN.deliveryMethodColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/dostawa" />;
}

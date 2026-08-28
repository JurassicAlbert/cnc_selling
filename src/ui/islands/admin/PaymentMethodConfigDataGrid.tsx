'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminPaymentMethodLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminPaymentMethodListItem } from '@/server/repositories/admin-payment-methods';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function PaymentMethodConfigDataGrid({ rows }: { readonly rows: readonly AdminPaymentMethodListItem[] }) {
  const columns: GridColDef<AdminPaymentMethodListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.paymentMethodColumnNamePl,
      flex: 2,
      minWidth: 200,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/platnosci/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'provider',
      headerName: ADMIN.paymentMethodColumnProviderPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: AdminPaymentMethodListItem['provider']) => adminPaymentMethodLabel(value),
    },
    {
      field: 'isConnected',
      headerName: ADMIN.paymentMethodColumnConnectedPl,
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl}
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'isActive',
      headerName: ADMIN.paymentMethodColumnStatusPl,
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

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/platnosci" />;
}

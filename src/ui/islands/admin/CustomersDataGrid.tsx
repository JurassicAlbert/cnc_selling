'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminCustomerListItem } from '@/server/repositories/admin-customers';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

/** ADMIN-01: one server-side page of customers, not the newest hundred. */
export function CustomersDataGrid({
  rows,
  page,
  pageSize,
  total,
}: {
  readonly rows: readonly AdminCustomerListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  const columns: GridColDef<AdminCustomerListItem>[] = [
    {
      field: 'name',
      headerName: ADMIN.customersColumnNamePl,
      flex: 1.1,
      minWidth: 170,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/klienci/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'email', headerName: ADMIN.customersColumnEmailPl, flex: 1.3, minWidth: 200 },
    {
      field: 'orderCount',
      headerName: ADMIN.customersColumnOrdersPl,
      flex: 0.6,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'createdAt',
      headerName: ADMIN.customersColumnRegisteredPl,
      flex: 0.8,
      minWidth: 130,
      valueFormatter: (value: Date) => value.toLocaleDateString('pl-PL'),
    },
    {
      field: 'anonymizedAt',
      headerName: '',
      flex: 0.8,
      minWidth: 140,
      sortable: false,
      renderCell: (params) => (params.value !== null ? <Chip size="small" label={ADMIN.customerAnonymizedChipPl} /> : null),
    },
  ];

  return (
    <EntityDataGrid
      rows={rows}
      columns={columns}
      basePath="/panel/klienci"
      serverPagination={{ page, pageSize, total }}
    />
  );
}

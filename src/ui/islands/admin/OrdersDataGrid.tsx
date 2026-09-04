'use client';

/**
 * First real `@mui/x-data-grid` usage in this codebase (P7c slice 2) -
 * `plPL`'s DataGrid locale is wired in `src/ui/theme/theme.ts`, so the
 * grid's own chrome (pagination "Wierszy na stronie", sort/filter menu
 * labels) renders in Polish automatically, no per-instance config needed.
 *
 * Column definitions mirror the plain `<Table>` this replaces 1:1 - same
 * data, same `AdminOrderListItem` shape from `admin-orders.ts`, nothing
 * new server-side. `onRowClick` navigates to the order's real detail page,
 * the natural DataGrid interaction on top of the existing `Numer` link.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Chip, Typography } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { formatPln } from '@/domain/money/money';
import type { AdminOrderListItem } from '@/server/repositories/admin-orders';
import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export function OrdersDataGrid({ rows }: { readonly rows: readonly AdminOrderListItem[] }) {
  const router = useRouter();
  const gridPreferences = useGridPreferences('orders');

  const columns: GridColDef<AdminOrderListItem>[] = [
    {
      field: 'orderNumber',
      headerName: ADMIN.ordersColumnNumberPl,
      flex: 1,
      minWidth: 140,
      renderCell: (params) => (
        <Link href={`/panel/zamowienia/${encodeURIComponent(params.value)}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'customerName',
      headerName: ADMIN.ordersColumnCustomerPl,
      flex: 1.4,
      minWidth: 200,
      sortComparator: comparePl,
      renderCell: (params) => (
        <div>
          {params.row.customerName}
          <br />
          <Typography variant="caption" color="text.secondary">
            {params.row.email}
          </Typography>
        </div>
      ),
    },
    {
      field: 'status',
      headerName: ADMIN.ordersColumnStatusPl,
      flex: 1,
      minWidth: 160,
      renderCell: (params) => <Chip size="small" label={adminOrderStatusLabel(params.row.status)} />,
    },
    {
      field: 'paymentStatus',
      headerName: ADMIN.ordersColumnPaymentPl,
      flex: 0.7,
      minWidth: 110,
    },
    {
      field: 'totalGrossGrosze',
      headerName: ADMIN.ordersColumnTotalPl,
      flex: 0.7,
      minWidth: 110,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: number) => formatPln(value),
    },
    {
      field: 'createdAt',
      headerName: ADMIN.ordersColumnDatePl,
      flex: 0.7,
      minWidth: 110,
      valueFormatter: (value: Date) => value.toLocaleDateString('pl-PL'),
    },
  ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.orderNumber}
      autoHeight
      showToolbar
      slots={{ toolbar: GridToolbar }}
      disableColumnMenu={false}
      onRowClick={(params: GridRowParams<AdminOrderListItem>) => router.push(`/panel/zamowienia/${encodeURIComponent(params.row.orderNumber)}`)}
      sx={{ cursor: 'pointer', border: 'none' }}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[25, 50, 100]}
      {...gridPreferences}
    />
  );
}

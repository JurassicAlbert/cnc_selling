'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminSupportRequestStatusLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminSupportRequestListItem } from '@/server/repositories/admin-support-requests';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

const STATUS_COLOR: Record<AdminSupportRequestListItem['status'], 'default' | 'info' | 'success' | 'warning'> = {
  NEW: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'default',
};

/** PERF-03: one server-side page of a list that grows with the business. */
export function SupportRequestDataGrid({
  rows,
  page,
  pageSize,
  total,
}: {
  readonly rows: readonly AdminSupportRequestListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  const columns: GridColDef<AdminSupportRequestListItem>[] = [
    {
      field: 'subjectPl',
      headerName: ADMIN.supportRequestColumnSubjectPl,
      flex: 2,
      minWidth: 220,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/kontakt/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'email', headerName: ADMIN.supportRequestColumnEmailPl, flex: 1.2, minWidth: 200 },
    {
      field: 'orderNumber',
      headerName: ADMIN.supportRequestColumnOrderPl,
      flex: 1,
      minWidth: 150,
      valueFormatter: (value: string | null) => value ?? '-',
    },
    {
      field: 'status',
      headerName: ADMIN.supportRequestColumnStatusPl,
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) => <Chip size="small" label={adminSupportRequestStatusLabel(params.value)} color={STATUS_COLOR[params.value as AdminSupportRequestListItem['status']]} />,
    },
    {
      field: 'createdAt',
      headerName: ADMIN.supportRequestColumnCreatedAtPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: Date) => value.toLocaleString('pl-PL'),
    },
  ];

  return (
    <EntityDataGrid
      rows={rows}
      columns={columns}
      basePath="/panel/kontakt"
      serverPagination={{ page, pageSize, total }}
    />
  );
}

'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { PendingDesignReviewItem } from '@/server/repositories/admin-design-review';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function DesignReviewDataGrid({ rows }: { readonly rows: readonly PendingDesignReviewItem[] }) {
  const columns: GridColDef<PendingDesignReviewItem>[] = [
    {
      field: 'originalName',
      headerName: ADMIN.designReviewColumnFilePl,
      flex: 1.4,
      minWidth: 200,
      renderCell: (params) => (
        <Link href={`/panel/weryfikacja/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'customerLabel', headerName: ADMIN.designReviewColumnCustomerPl, flex: 1, minWidth: 180 },
    {
      field: 'createdAt',
      headerName: ADMIN.designReviewColumnDatePl,
      flex: 0.9,
      minWidth: 160,
      valueFormatter: (value: Date) => value.toLocaleString('pl-PL'),
    },
  ];

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/weryfikacja" />;
}

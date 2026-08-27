'use client';

/**
 * P7c slice 5 — Opinie has no detail page to navigate to, only per-row
 * approve/reject actions, so this is a standalone `DataGrid` (not
 * `EntityDataGrid`, which is built around row-click navigation) with no
 * `onRowClick` at all. The action cells render the exact same real
 * `<form action={setReviewStatus.bind(...)}>` the plain `<Table>` version
 * already used — zero-extra-JS-required mutation, unchanged; only the
 * surrounding table became a grid.
 */

import { Button, Chip } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminReviewStatusLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { setReviewStatus } from '@/server/actions/admin-reviews';
import type { AdminReviewListItem } from '@/server/repositories/admin-reviews';
import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export function OpinieDataGrid({ rows }: { readonly rows: readonly AdminReviewListItem[] }) {
  const gridPreferences = useGridPreferences('opinie');
  const columns: GridColDef<AdminReviewListItem>[] = [
    { field: 'orderNumber', headerName: ADMIN.reviewsColumnOrderPl, flex: 0.8, minWidth: 130 },
    { field: 'authorNamePl', headerName: ADMIN.reviewsColumnAuthorPl, flex: 0.8, minWidth: 140, sortComparator: comparePl },
    { field: 'rating', headerName: ADMIN.reviewsColumnRatingPl, flex: 0.4, minWidth: 80, align: 'right', headerAlign: 'right' },
    { field: 'bodyPl', headerName: ADMIN.reviewsColumnBodyPl, flex: 2, minWidth: 260 },
    {
      field: 'createdAt',
      headerName: ADMIN.reviewsColumnDatePl,
      flex: 0.6,
      minWidth: 110,
      valueFormatter: (value: Date) => value.toLocaleDateString('pl-PL'),
    },
    {
      field: 'status',
      headerName: ADMIN.reviewsFilterStatusPl,
      flex: 0.7,
      minWidth: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={adminReviewStatusLabel(params.value)}
          color={params.value === 'APPROVED' ? 'success' : params.value === 'REJECTED' ? 'default' : 'warning'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      flex: 0.9,
      minWidth: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <>
          {params.row.status !== 'APPROVED' && (
            <form action={setReviewStatus.bind(null, params.row.id, 'APPROVED')} style={{ display: 'inline' }}>
              <Button type="submit" size="small">
                {ADMIN.reviewApprovePl}
              </Button>
            </form>
          )}
          {params.row.status !== 'REJECTED' && (
            <form action={setReviewStatus.bind(null, params.row.id, 'REJECTED')} style={{ display: 'inline' }}>
              <Button type="submit" size="small" color="error">
                {ADMIN.reviewRejectPl}
              </Button>
            </form>
          )}
        </>
      ),
    },
  ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      autoHeight
      showToolbar
      slots={{ toolbar: GridToolbar }}
      sx={{ border: 'none' }}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[25, 50, 100]}
      {...gridPreferences}
    />
  );
}

'use client';

/**
 * Shared `DataGrid` wrapper for the panel's simple catalogue list pages
 * (Kategorie, Produkty, Materiały, Wykończenia, Wzory, Kolekcje) — P7c
 * slice 3. `OrdersDataGrid.tsx` (slice 2) hand-rolled its own wrapper
 * since Orders was the first usage and uniquely complex; these six pages
 * are simple and near-identical, so the boilerplate (row click →
 * navigate, row id, pagination defaults) is extracted once here. Column
 * definitions stay per-entity (`renderCell` differs by page) — that's the
 * one genuinely page-specific piece, passed in as a prop.
 *
 * No `encodeURIComponent` on the navigated id, unlike `OrdersDataGrid`'s
 * human-facing `orderNumber` — every entity this wraps uses a plain cuid
 * `id` with no slashes.
 *
 * `onCellClick` below guards against a real interaction bug (P7c slice 9):
 * `onRowClick` fires on ANY click in a row, including the first click of a
 * double-click-to-edit on an `editable` cell — without the guard, clicking
 * to edit e.g. `sortOrder` would navigate away before the edit could start.
 * `event.stopPropagation()` on an editable cell's click stops that row
 * handler from firing — the documented MUI X Data Grid pattern for this,
 * same principle as the existing Link-cell columns' own
 * `onClick={(e) => e.stopPropagation()}`, just at the grid level since an
 * editable cell has no child element of its own to attach that to.
 */

import { useRouter } from 'next/navigation';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridCellParams, GridColDef, GridRowParams } from '@mui/x-data-grid';

import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export function EntityDataGrid<T extends { readonly id: string }>({
  rows,
  columns,
  basePath,
  processRowUpdate,
  onProcessRowUpdateError,
}: {
  readonly rows: readonly T[];
  readonly columns: GridColDef<T>[];
  readonly basePath: string;
  /** Enables inline cell editing (P7c slice 9) — pass alongside `editable: true` columns. */
  readonly processRowUpdate?: (newRow: T, oldRow: T) => Promise<T>;
  readonly onProcessRowUpdateError?: (error: unknown) => void;
}) {
  const router = useRouter();
  const gridPreferences = useGridPreferences(basePath);

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      autoHeight
      showToolbar
      slots={{ toolbar: GridToolbar }}
      onRowClick={(params: GridRowParams<T>) => router.push(`${basePath}/${params.row.id}`)}
      onCellClick={(params: GridCellParams<T>, event) => {
        if (params.colDef.editable === true) {
          event.stopPropagation();
        }
      }}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={onProcessRowUpdateError}
      sx={{ cursor: 'pointer', border: 'none' }}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[25, 50, 100]}
      {...gridPreferences}
    />
  );
}

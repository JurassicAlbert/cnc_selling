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
 */

import { useRouter } from 'next/navigation';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export function EntityDataGrid<T extends { readonly id: string }>({
  rows,
  columns,
  basePath,
}: {
  readonly rows: readonly T[];
  readonly columns: GridColDef<T>[];
  readonly basePath: string;
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
      sx={{ cursor: 'pointer', border: 'none' }}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[25, 50, 100]}
      {...gridPreferences}
    />
  );
}

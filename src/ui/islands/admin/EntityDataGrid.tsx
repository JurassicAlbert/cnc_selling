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
 *
 * `bulkActions` (P7c, bulk-actions slice) turns on checkbox selection and
 * renders a small selection toolbar above the grid once at least one row is
 * checked — "Zaznaczono N" plus one button per action. Each action's `run`
 * receives the selected ids and is expected to be a real Server Action
 * (bulk toggle functions live next to their single-row equivalents, e.g.
 * `bulkSetCategoryActive` beside `setCategoryActive`). Selection is cleared
 * and `router.refresh()` is called after a successful run; errors are
 * logged and the selection is left as-is so the admin can retry.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Paper, Typography } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridCellParams, GridColDef, GridRowParams, GridRowSelectionModel } from '@mui/x-data-grid';

import { ADMIN, bulkSelectionCountMessage } from '@/content/pl/admin';
import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export type EntityBulkAction = {
  readonly label: string;
  readonly run: (ids: readonly string[]) => Promise<void>;
};

export function EntityDataGrid<T extends { readonly id: string }>({
  rows,
  columns,
  basePath,
  processRowUpdate,
  onProcessRowUpdateError,
  bulkActions,
}: {
  readonly rows: readonly T[];
  readonly columns: GridColDef<T>[];
  readonly basePath: string;
  /** Enables inline cell editing (P7c slice 9) — pass alongside `editable: true` columns. */
  readonly processRowUpdate?: (newRow: T, oldRow: T) => Promise<T>;
  readonly onProcessRowUpdateError?: (error: unknown) => void;
  /** Enables checkbox selection + the selection toolbar (P7c bulk-actions slice). */
  readonly bulkActions?: readonly EntityBulkAction[];
}) {
  const router = useRouter();
  const gridPreferences = useGridPreferences(basePath);
  const [selection, setSelection] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [running, setRunning] = useState(false);
  const selectedIds = [...selection.ids].map((id) => String(id));

  async function runBulkAction(action: EntityBulkAction) {
    setRunning(true);
    try {
      await action.run(selectedIds);
      setSelection({ type: 'include', ids: new Set() });
      router.refresh();
    } catch (error) {
      console.error('[EntityDataGrid] bulk action failed:', error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Box>
      {bulkActions !== undefined && selectedIds.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, mb: 1, flexWrap: 'wrap' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {bulkSelectionCountMessage(selectedIds.length)}
          </Typography>
          {bulkActions.map((action) => (
            <Button key={action.label} size="small" variant="outlined" disabled={running} onClick={() => void runBulkAction(action)}>
              {action.label}
            </Button>
          ))}
          <Button size="small" disabled={running} onClick={() => setSelection({ type: 'include', ids: new Set() })}>
            {ADMIN.bulkClearSelectionPl}
          </Button>
        </Paper>
      )}
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        showToolbar
        slots={{ toolbar: GridToolbar }}
        checkboxSelection={bulkActions !== undefined}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
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
    </Box>
  );
}

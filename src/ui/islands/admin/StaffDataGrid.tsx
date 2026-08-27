'use client';

/**
 * P7c slice 5 — same reasoning as `OpinieDataGrid`: Personel has no
 * detail page, only a per-row revoke action, so this is a standalone
 * `DataGrid` with no `onRowClick`. `currentUserId` is passed in (the page
 * already derived it via `requireAdminSession()` — a client island can't
 * call that itself) so the acting admin's own row never renders a revoke
 * button, matching the plain-`<Table>` version's own guard exactly.
 */

import { Button } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminStaffRoleLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { changeStaffRole } from '@/server/actions/admin-staff';
import type { StaffListItem } from '@/server/repositories/admin-staff';
import { useGridPreferences } from '@/ui/islands/admin/useGridPreferences';

export function StaffDataGrid({ rows, currentUserId }: { readonly rows: readonly StaffListItem[]; readonly currentUserId: string }) {
  const gridPreferences = useGridPreferences('personel');
  const columns: GridColDef<StaffListItem>[] = [
    { field: 'name', headerName: ADMIN.staffColumnNamePl, flex: 1, minWidth: 160, sortComparator: comparePl },
    { field: 'email', headerName: ADMIN.staffColumnEmailPl, flex: 1.2, minWidth: 200 },
    {
      field: 'role',
      headerName: ADMIN.staffColumnRolePl,
      flex: 0.7,
      minWidth: 130,
      valueFormatter: (value: StaffListItem['role']) => adminStaffRoleLabel(value),
    },
    {
      field: 'actions',
      headerName: '',
      flex: 0.7,
      minWidth: 140,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.id !== currentUserId ? (
          <form action={changeStaffRole.bind(null, params.row.id, 'CUSTOMER')}>
            <Button type="submit" size="small" color="error">
              {ADMIN.staffRevokeButtonPl}
            </Button>
          </form>
        ) : null,
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

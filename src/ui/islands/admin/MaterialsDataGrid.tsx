'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminMaterialFamilyLabel } from '@/content/pl/admin';
import { setMaterialAvailable, setMaterialSortOrder } from '@/server/actions/admin-materials';
import type { AdminMaterialListItem } from '@/server/repositories/admin-materials';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function MaterialsDataGrid({ rows }: { readonly rows: readonly AdminMaterialListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminMaterialListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.materialsColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Link href={`/panel/materialy/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'family',
      headerName: ADMIN.materialsColumnFamilyPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: AdminMaterialListItem['family']) => adminMaterialFamilyLabel(value),
    },
    {
      field: 'sortOrder',
      headerName: ADMIN.materialFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isAvailable',
      headerName: ADMIN.materialsColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setMaterialAvailable(params.row.id, e.target.checked);
            router.refresh();
          }}
        />
      ),
    },
  ];

  return (
    <EntityDataGrid
      rows={rows}
      columns={columns}
      basePath="/panel/materialy"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setMaterialSortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[MaterialsDataGrid] row update failed:', error)}
    />
  );
}

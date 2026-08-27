'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminFinishKindLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { setFinishAvailable, setFinishSortOrder } from '@/server/actions/admin-finishes';
import type { AdminFinishListItem } from '@/server/repositories/admin-finishes';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function FinishesDataGrid({ rows }: { readonly rows: readonly AdminFinishListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminFinishListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.finishesColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/wykonczenia/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'kind',
      headerName: ADMIN.finishesColumnKindPl,
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: AdminFinishListItem['kind']) => adminFinishKindLabel(value),
    },
    {
      field: 'sortOrder',
      headerName: ADMIN.finishFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isAvailable',
      headerName: ADMIN.finishesColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setFinishAvailable(params.row.id, e.target.checked);
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
      basePath="/panel/wykonczenia"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setFinishSortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[FinishesDataGrid] row update failed:', error)}
    />
  );
}

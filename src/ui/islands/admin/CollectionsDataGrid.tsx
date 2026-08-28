'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { bulkSetCollectionActive, setCollectionActive, setCollectionSortOrder } from '@/server/actions/admin-designs';
import type { AdminCollectionListItem } from '@/server/repositories/admin-designs';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function CollectionsDataGrid({ rows }: { readonly rows: readonly AdminCollectionListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminCollectionListItem>[] = [
    {
      field: 'namePl',
      headerName: ADMIN.collectionsColumnNamePl,
      flex: 1.2,
      minWidth: 180,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/kolekcje/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'designCount',
      headerName: ADMIN.collectionsColumnDesignsPl,
      flex: 0.6,
      minWidth: 100,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'sortOrder',
      headerName: ADMIN.collectionFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isActive',
      headerName: ADMIN.collectionsColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setCollectionActive(params.row.id, e.target.checked);
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
      basePath="/panel/kolekcje"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setCollectionSortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[CollectionsDataGrid] row update failed:', error)}
      bulkActions={[
        { label: ADMIN.activatePl, run: (ids) => bulkSetCollectionActive(ids, true) },
        { label: ADMIN.deactivatePl, run: (ids) => bulkSetCollectionActive(ids, false) },
      ]}
    />
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chip, Switch } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN, adminDesignRightsStatusLabel } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import { setDesignActive, setDesignSortOrder } from '@/server/actions/admin-designs';
import type { AdminDesignListItem } from '@/server/repositories/admin-designs';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

const SELLABLE_RIGHTS = new Set(['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN']);

export function DesignsDataGrid({ rows }: { readonly rows: readonly AdminDesignListItem[] }) {
  const router = useRouter();

  const columns: GridColDef<AdminDesignListItem>[] = [
    {
      field: 'code',
      headerName: ADMIN.designsColumnCodePl,
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) => (
        <Link href={`/panel/wzory/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'namePl', headerName: ADMIN.designsColumnNamePl, flex: 1.2, minWidth: 180, sortComparator: comparePl },
    {
      field: 'rightsStatus',
      headerName: ADMIN.designsColumnRightsPl,
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Chip
          size="small"
          label={adminDesignRightsStatusLabel(params.value)}
          color={SELLABLE_RIGHTS.has(params.value) ? 'success' : 'warning'}
        />
      ),
    },
    {
      field: 'sortOrder',
      headerName: ADMIN.designFieldSortOrderPl,
      flex: 0.6,
      minWidth: 130,
      type: 'number',
      editable: true,
    },
    {
      field: 'isActive',
      headerName: ADMIN.designsColumnStatusPl,
      flex: 0.7,
      minWidth: 110,
      renderCell: (params) => (
        <Switch
          size="small"
          checked={params.value}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            await setDesignActive(params.row.id, e.target.checked);
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
      basePath="/panel/wzory"
      processRowUpdate={async (newRow, oldRow) => {
        if (newRow.sortOrder !== oldRow.sortOrder) {
          await setDesignSortOrder(newRow.id, newRow.sortOrder);
          router.refresh();
        }
        return newRow;
      }}
      onProcessRowUpdateError={(error) => console.error('[DesignsDataGrid] row update failed:', error)}
    />
  );
}

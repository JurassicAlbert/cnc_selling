'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import type { AdminFaqListItem } from '@/server/repositories/admin-faq';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

export function FaqDataGrid({ rows }: { readonly rows: readonly AdminFaqListItem[] }) {
  const columns: GridColDef<AdminFaqListItem>[] = [
    {
      field: 'questionPl',
      headerName: ADMIN.faqColumnQuestionPl,
      flex: 2,
      minWidth: 260,
      renderCell: (params) => (
        <Link href={`/panel/faq/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'isActive',
      headerName: ADMIN.faqColumnStatusPl,
      flex: 0.7,
      minWidth: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl}
          color={params.value ? 'success' : 'default'}
        />
      ),
    },
  ];

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/faq" />;
}

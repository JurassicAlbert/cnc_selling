'use client';

import Link from 'next/link';
import { Chip } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';

import { ADMIN } from '@/content/pl/admin';
import { comparePl } from '@/domain/text/collation';
import type { AdminBlogPostListItem } from '@/server/repositories/admin-blog';
import { EntityDataGrid } from '@/ui/islands/admin/EntityDataGrid';

function publishStatus(post: AdminBlogPostListItem): { readonly labelPl: string; readonly color: 'success' | 'warning' | 'default' } {
  if (post.publishedAt === null) {
    return { labelPl: ADMIN.blogPostDraftLabelPl, color: 'default' };
  }
  if (post.publishedAt.getTime() > Date.now()) {
    return { labelPl: ADMIN.blogPostScheduledLabelPl, color: 'warning' };
  }
  return { labelPl: ADMIN.blogPostPublishedLabelPl, color: 'success' };
}

export function BlogPostsDataGrid({ rows }: { readonly rows: readonly AdminBlogPostListItem[] }) {
  const columns: GridColDef<AdminBlogPostListItem>[] = [
    {
      field: 'titlePl',
      headerName: ADMIN.blogPostsColumnTitlePl,
      flex: 1.4,
      minWidth: 220,
      sortComparator: comparePl,
      renderCell: (params) => (
        <Link href={`/panel/blog/${params.row.id}`} onClick={(e) => e.stopPropagation()}>
          {params.value}
        </Link>
      ),
    },
    { field: 'slug', headerName: ADMIN.blogPostsColumnSlugPl, flex: 1, minWidth: 160 },
    {
      field: 'publishedAt',
      headerName: ADMIN.blogPostsColumnPublishedPl,
      flex: 0.8,
      minWidth: 140,
      renderCell: (params) => {
        const status = publishStatus(params.row);
        return <Chip size="small" label={status.labelPl} color={status.color} />;
      },
    },
    {
      field: 'isActive',
      headerName: ADMIN.blogPostsColumnStatusPl,
      flex: 0.7,
      minWidth: 130,
      renderCell: (params) => (
        <Chip size="small" label={params.value ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={params.value ? 'success' : 'default'} />
      ),
    },
  ];

  return <EntityDataGrid rows={rows} columns={columns} basePath="/panel/blog" />;
}

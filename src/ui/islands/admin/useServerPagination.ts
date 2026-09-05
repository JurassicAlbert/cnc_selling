'use client';

/**
 * Server-side pagination for the admin grids - `docs/AI-CHECKLIST.md`
 * ADMIN-01.
 *
 * The page lives in the URL, not in client state. Every one of these grids
 * already sits under a Server Component whose filters are `searchParams`, so
 * a page number belongs in the same place: changing it re-renders the page on
 * the server with the next slice, and no data fetching moves into the
 * browser. It also makes a page shareable and bookmarkable, and it survives a
 * reload, which client-held pagination state does not.
 *
 * `router.push` rather than `replace`, so Back goes to the previous page of
 * the list - which is what a person who has just clicked "next" expects Back
 * to do.
 *
 * Sorting stays client-side and therefore stays within the current page. That
 * is a real limitation and it is deliberate: making sort server-side means
 * every sortable column needs a validated mapping to a Prisma `orderBy`, and
 * the lists are ordered newest-first, which is the order staff actually want.
 * Recorded rather than hidden - see ADMIN-01's own entry.
 */

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { GridPaginationModel } from '@mui/x-data-grid';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/domain/pagination/page';

export const PAGE_SIZE_OPTIONS: readonly number[] = [DEFAULT_PAGE_SIZE, 50, MAX_PAGE_SIZE];

export function useServerPagination(params: {
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPaginationModelChange = useCallback(
    (model: GridPaginationModel) => {
      // Built from the current query so the filters above the grid survive
      // paging - losing them on "next page" would be its own bug.
      const next = new URLSearchParams(searchParams.toString());
      next.set('page', String(model.page + 1));
      next.set('perPage', String(model.pageSize));
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return {
    paginationMode: 'server' as const,
    rowCount: params.total,
    paginationModel: { page: params.pageIndex, pageSize: params.pageSize },
    onPaginationModelChange,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}

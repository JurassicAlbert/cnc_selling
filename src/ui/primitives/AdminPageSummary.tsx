import Link from 'next/link';
import { Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { describePage } from '@/domain/pagination/page';

/**
 * „Pokazano 1-25 z 166" - `docs/AI-CHECKLIST.md` ADMIN-01.
 *
 * The panel's three biggest lists used to return the newest N rows and stop,
 * with nothing on screen saying so. That is the part that made it a bug
 * rather than a limitation: staff had no way to know they were looking at a
 * subset, so 66 of 166 orders were unreachable and everything looked fine.
 *
 * A Server Component - it renders a number the server already knows.
 */
export function AdminPageSummary({
  skip,
  take,
  total,
}: {
  readonly skip: number;
  readonly take: number;
  readonly total: number;
}) {
  const range = describePage({ skip, take, total });

  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {range.total === 0 || range.to === 0
        ? ADMIN.adminPageEmptySummaryPl(range.total)
        : ADMIN.adminPageSummaryPl(range.from, range.to, range.total)}
    </Typography>
  );
}

/**
 * Previous/next for a list that is a plain `<Table>` rather than a
 * `DataGrid` - the audit log, which has no grid to carry its own pager.
 *
 * Plain links, so it works with no client JavaScript at all and each page is
 * a real URL somebody can share or bookmark. A boundary is a missing link
 * rather than a disabled one: there is no such thing as a disabled anchor,
 * and an anchor with no `href` is correctly unfocusable.
 */
export function AdminPager({
  basePath,
  params,
  pageIndex,
  pageSize,
  total,
}: {
  readonly basePath: string;
  /** The current query, so filters survive paging. */
  readonly params: Record<string, string | undefined>;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  const hrefFor = (nextPageIndex: number): string => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value.length > 0 && key !== 'page' && key !== 'perPage') {
        query.set(key, value);
      }
    }
    query.set('page', String(nextPageIndex + 1));
    query.set('perPage', String(pageSize));
    return `${basePath}?${query.toString()}`;
  };

  const hasPrevious = pageIndex > 0;
  const hasNext = (pageIndex + 1) * pageSize < total;

  if (!hasPrevious && !hasNext) {
    return null;
  }

  return (
    <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
      {hasPrevious && <Link href={hrefFor(pageIndex - 1)}>{ADMIN.adminPagePreviousPl}</Link>}
      {hasNext && <Link href={hrefFor(pageIndex + 1)}>{ADMIN.adminPageNextPl}</Link>}
    </Stack>
  );
}

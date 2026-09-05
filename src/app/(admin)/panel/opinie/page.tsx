import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';

import { ADMIN, adminReviewStatusLabel } from '@/content/pl/admin';
import { listReviewsForAdmin } from '@/server/repositories/admin-reviews';
import { parsePagination } from '@/domain/pagination/page';
import { AdminPageSummary } from '@/ui/primitives/AdminPageSummary';
import { OpinieDataGrid } from '@/ui/islands/admin/OpinieDataGrid';
import type { ReviewStatus } from '@/generated/prisma/enums';

type AdminReviewsPageProps = {
  readonly searchParams: Promise<{ readonly status?: string; readonly page?: string; readonly perPage?: string }>;
};

const STATUSES: readonly ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const params = await searchParams;
  const filterStatus = isReviewStatus(params.status) ? params.status : undefined;
  // PERF-03. The status filter above is a set of links, and
  // `useServerPagination` rebuilds the query from whatever is already there -
  // so paging keeps the filter and vice versa.
  const page = parsePagination(params);
  const reviews = await listReviewsForAdmin(filterStatus, page);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.reviewsHeadingPl}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Link href="/panel/opinie">
          <Button variant={filterStatus === undefined ? 'contained' : 'outlined'} size="small">
            {ADMIN.ordersFilterAnyPl}
          </Button>
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/panel/opinie?status=${s}`}>
            <Button variant={filterStatus === s ? 'contained' : 'outlined'} size="small">
              {adminReviewStatusLabel(s)}
            </Button>
          </Link>
        ))}
      </Stack>

      {reviews.total === 0 ? (
        <Typography color="text.secondary">{ADMIN.reviewsEmptyPl}</Typography>
      ) : (
        <>
          <AdminPageSummary skip={page.skip} take={page.take} total={reviews.total} />
          <OpinieDataGrid
            rows={reviews.items}
            page={page.pageIndex}
            pageSize={page.pageSize}
            total={reviews.total}
          />
        </>
      )}
    </>
  );
}

function isReviewStatus(value: string | undefined): value is ReviewStatus {
  return value !== undefined && (STATUSES as readonly string[]).includes(value);
}

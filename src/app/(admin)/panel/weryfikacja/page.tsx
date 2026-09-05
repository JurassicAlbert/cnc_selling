import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listPendingDesignReviews } from '@/server/repositories/admin-design-review';
import { parsePagination } from '@/domain/pagination/page';
import { AdminPageSummary } from '@/ui/primitives/AdminPageSummary';
import { DesignReviewDataGrid } from '@/ui/islands/admin/DesignReviewDataGrid';

type PageProps = {
  readonly searchParams: Promise<{ readonly page?: string; readonly perPage?: string }>;
};

export default async function AdminDesignReviewQueuePage({ searchParams }: PageProps) {
  // PERF-03. The largest of the four: 212 rows in the development database
  // today, and one more per custom upload from here on.
  const page = parsePagination(await searchParams);
  const designs = await listPendingDesignReviews(page);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.designReviewHeadingPl}
      </Typography>

      {designs.total === 0 ? (
        <Typography color="text.secondary">{ADMIN.designReviewEmptyPl}</Typography>
      ) : (
        <>
          <AdminPageSummary skip={page.skip} take={page.take} total={designs.total} />
          <DesignReviewDataGrid
            rows={designs.items}
            page={page.pageIndex}
            pageSize={page.pageSize}
            total={designs.total}
          />
        </>
      )}
    </>
  );
}

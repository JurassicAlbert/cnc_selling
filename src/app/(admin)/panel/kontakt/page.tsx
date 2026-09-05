import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listSupportRequestsForAdmin } from '@/server/repositories/admin-support-requests';
import { parsePagination } from '@/domain/pagination/page';
import { AdminPageSummary } from '@/ui/primitives/AdminPageSummary';
import { SupportRequestDataGrid } from '@/ui/islands/admin/SupportRequestDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

type PageProps = {
  readonly searchParams: Promise<{ readonly page?: string; readonly perPage?: string }>;
};

export default async function AdminSupportRequestsPage({ searchParams }: PageProps) {
  // PERF-03: one page, and the page number lives in the URL - same shape as
  // ADMIN-01, so a link to a page survives a reload and can be shared.
  const page = parsePagination(await searchParams);
  const requests = await listSupportRequestsForAdmin({}, page);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.supportRequestsHeadingPl}
      </Typography>

      {requests.total === 0 ? (
        <EmptyState message={ADMIN.supportRequestsEmptyPl} />
      ) : (
        <>
          <AdminPageSummary skip={page.skip} take={page.take} total={requests.total} />
          <SupportRequestDataGrid
            rows={requests.items}
            page={page.pageIndex}
            pageSize={page.pageSize}
            total={requests.total}
          />
        </>
      )}
    </>
  );
}

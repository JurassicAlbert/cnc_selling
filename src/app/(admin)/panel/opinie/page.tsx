import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';

import { ADMIN, adminReviewStatusLabel } from '@/content/pl/admin';
import { listReviewsForAdmin } from '@/server/repositories/admin-reviews';
import { OpinieDataGrid } from '@/ui/islands/admin/OpinieDataGrid';
import type { ReviewStatus } from '@/generated/prisma/enums';

type AdminReviewsPageProps = {
  readonly searchParams: Promise<{ readonly status?: string }>;
};

const STATUSES: readonly ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  const { status } = await searchParams;
  const filterStatus = isReviewStatus(status) ? status : undefined;
  const reviews = await listReviewsForAdmin(filterStatus);

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

      {reviews.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.reviewsEmptyPl}</Typography>
      ) : (
        <OpinieDataGrid rows={reviews} />
      )}
    </>
  );
}

function isReviewStatus(value: string | undefined): value is ReviewStatus {
  return value !== undefined && (STATUSES as readonly string[]).includes(value);
}

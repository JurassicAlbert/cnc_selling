import Link from 'next/link';
import { Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminReviewStatusLabel } from '@/content/pl/admin';
import { listReviewsForAdmin } from '@/server/repositories/admin-reviews';
import { setReviewStatus } from '@/server/actions/admin-reviews';
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
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.reviewsColumnOrderPl}</TableCell>
              <TableCell>{ADMIN.reviewsColumnAuthorPl}</TableCell>
              <TableCell align="right">{ADMIN.reviewsColumnRatingPl}</TableCell>
              <TableCell>{ADMIN.reviewsColumnBodyPl}</TableCell>
              <TableCell>{ADMIN.reviewsColumnDatePl}</TableCell>
              <TableCell>{ADMIN.reviewsFilterStatusPl}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id} hover>
                <TableCell>{review.orderNumber}</TableCell>
                <TableCell>{review.authorNamePl}</TableCell>
                <TableCell align="right">{review.rating}</TableCell>
                <TableCell sx={{ maxWidth: 320 }}>{review.bodyPl}</TableCell>
                <TableCell>{review.createdAt.toLocaleDateString('pl-PL')}</TableCell>
                <TableCell>
                  <Chip size="small" label={adminReviewStatusLabel(review.status)} color={review.status === 'APPROVED' ? 'success' : review.status === 'REJECTED' ? 'default' : 'warning'} />
                </TableCell>
                <TableCell>
                  {review.status !== 'APPROVED' && (
                    <form action={setReviewStatus.bind(null, review.id, 'APPROVED')} style={{ display: 'inline' }}>
                      <Button type="submit" size="small">
                        {ADMIN.reviewApprovePl}
                      </Button>
                    </form>
                  )}
                  {review.status !== 'REJECTED' && (
                    <form action={setReviewStatus.bind(null, review.id, 'REJECTED')} style={{ display: 'inline' }}>
                      <Button type="submit" size="small" color="error">
                        {ADMIN.reviewRejectPl}
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function isReviewStatus(value: string | undefined): value is ReviewStatus {
  return value !== undefined && (STATUSES as readonly string[]).includes(value);
}

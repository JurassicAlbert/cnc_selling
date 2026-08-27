import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listPendingDesignReviews } from '@/server/repositories/admin-design-review';

export default async function AdminDesignReviewQueuePage() {
  const designs = await listPendingDesignReviews();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.designReviewHeadingPl}
      </Typography>

      {designs.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.designReviewEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.designReviewColumnFilePl}</TableCell>
              <TableCell>{ADMIN.designReviewColumnCustomerPl}</TableCell>
              <TableCell>{ADMIN.designReviewColumnDatePl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {designs.map((design) => (
              <TableRow key={design.id} hover>
                <TableCell>
                  <Link href={`/panel/weryfikacja/${design.id}`}>{design.originalName}</Link>
                </TableCell>
                <TableCell>{design.customerLabel}</TableCell>
                <TableCell>{design.createdAt.toLocaleString('pl-PL')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

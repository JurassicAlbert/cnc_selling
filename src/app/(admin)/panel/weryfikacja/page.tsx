import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listPendingDesignReviews } from '@/server/repositories/admin-design-review';
import { DesignReviewDataGrid } from '@/ui/islands/admin/DesignReviewDataGrid';

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
        <DesignReviewDataGrid rows={designs} />
      )}
    </>
  );
}

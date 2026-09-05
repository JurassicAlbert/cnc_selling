import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listSupportRequestsForAdmin } from '@/server/repositories/admin-support-requests';
import { SupportRequestDataGrid } from '@/ui/islands/admin/SupportRequestDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminSupportRequestsPage() {
  const requests = await listSupportRequestsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.supportRequestsHeadingPl}
      </Typography>

      {requests.length === 0 ? (
        <EmptyState message={ADMIN.supportRequestsEmptyPl} />
      ) : (
        <SupportRequestDataGrid rows={requests} />
      )}
    </>
  );
}

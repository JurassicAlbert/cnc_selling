import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listDeliveryMethodsForAdmin } from '@/server/repositories/admin-delivery-methods';
import { DeliveryMethodDataGrid } from '@/ui/islands/admin/DeliveryMethodDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminDeliveryMethodsPage() {
  const methods = await listDeliveryMethodsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.deliveryMethodsHeadingPl}
        <Link href="/panel/dostawa/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.deliveryMethodsNewPl}
          </Button>
        </Link>
      </Typography>

      {methods.length === 0 ? (
        <EmptyState message={ADMIN.deliveryMethodsEmptyPl} actionLabel={ADMIN.deliveryMethodsNewPl} actionHref="/panel/dostawa/nowa" />
      ) : (
        <DeliveryMethodDataGrid rows={methods} />
      )}
    </>
  );
}

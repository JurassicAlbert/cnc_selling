import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listPaymentMethodConfigsForAdmin } from '@/server/repositories/admin-payment-methods';
import { PaymentMethodConfigDataGrid } from '@/ui/islands/admin/PaymentMethodConfigDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminPaymentMethodsPage() {
  const methods = await listPaymentMethodConfigsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.paymentMethodsHeadingPl}
        <Link href="/panel/platnosci/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.paymentMethodsNewPl}
          </Button>
        </Link>
      </Typography>

      {methods.length === 0 ? (
        <EmptyState message={ADMIN.paymentMethodsEmptyPl} actionLabel={ADMIN.paymentMethodsNewPl} actionHref="/panel/platnosci/nowa" />
      ) : (
        <PaymentMethodConfigDataGrid rows={methods} />
      )}
    </>
  );
}

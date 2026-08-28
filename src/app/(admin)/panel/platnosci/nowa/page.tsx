import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { PaymentMethodConfigForm } from '@/ui/islands/admin/PaymentMethodConfigForm';

export default function AdminNewPaymentMethodPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.paymentMethodsNewPl}
      </Typography>
      <PaymentMethodConfigForm />
    </>
  );
}

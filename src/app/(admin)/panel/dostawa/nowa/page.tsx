import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { DeliveryMethodForm } from '@/ui/islands/admin/DeliveryMethodForm';

export default function AdminNewDeliveryMethodPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.deliveryMethodsNewPl}
      </Typography>
      <DeliveryMethodForm />
    </>
  );
}

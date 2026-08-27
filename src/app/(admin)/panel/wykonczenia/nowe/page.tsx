import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { FinishForm } from '@/ui/islands/admin/FinishForm';

export default function AdminNewFinishPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.finishesNewPl}
      </Typography>
      <FinishForm />
    </>
  );
}

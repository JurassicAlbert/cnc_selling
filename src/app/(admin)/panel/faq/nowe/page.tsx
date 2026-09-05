import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { FaqForm } from '@/ui/islands/admin/FaqForm';

export default function AdminNewFaqPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.faqNewPl}
      </Typography>
      <FaqForm />
    </>
  );
}

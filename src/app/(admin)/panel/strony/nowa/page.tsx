import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { StaticPageForm } from '@/ui/islands/admin/StaticPageForm';

export default function AdminNewStaticPagePage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.staticPagesNewPl}
      </Typography>
      <StaticPageForm />
    </>
  );
}

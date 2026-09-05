import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { ExternalPatternResourceForm } from '@/ui/islands/admin/ExternalPatternResourceForm';

export default function AdminNewExternalPatternResourcePage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.externalPatternResourcesNewPl}
      </Typography>
      <ExternalPatternResourceForm />
    </>
  );
}

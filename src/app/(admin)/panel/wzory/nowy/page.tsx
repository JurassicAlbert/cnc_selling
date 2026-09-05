import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCollectionOptionsForAdmin } from '@/server/repositories/admin-designs';
import { DesignForm } from '@/ui/islands/admin/DesignForm';

export default async function AdminNewDesignPage() {
  const collections = await listCollectionOptionsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.designsNewPl}
      </Typography>
      <DesignForm collections={collections} />
    </>
  );
}

import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { CollectionForm } from '@/ui/islands/admin/CollectionForm';

export default function AdminNewCollectionPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.collectionsNewPl}
      </Typography>
      <CollectionForm />
    </>
  );
}

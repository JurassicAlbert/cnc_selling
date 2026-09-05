import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { ProductCollectionForm } from '@/ui/islands/admin/ProductCollectionForm';

export default function AdminNewProductCollectionPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.productCollectionsNewPl}
      </Typography>
      <ProductCollectionForm />
    </>
  );
}

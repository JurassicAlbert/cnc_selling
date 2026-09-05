import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCategoryOptionsForAdmin } from '@/server/repositories/admin-products';
import { ProductForm } from '@/ui/islands/admin/ProductForm';

export default async function AdminNewProductPage() {
  const categories = await listCategoryOptionsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.productsNewPl}
      </Typography>
      <ProductForm categories={categories} />
    </>
  );
}

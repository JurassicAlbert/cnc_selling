import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { CategoryForm } from '@/ui/islands/admin/CategoryForm';

export default function AdminNewCategoryPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.categoriesNewPl}
      </Typography>
      <CategoryForm />
    </>
  );
}

import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { MaterialForm } from '@/ui/islands/admin/MaterialForm';

export default function AdminNewMaterialPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.materialsNewPl}
      </Typography>
      <MaterialForm />
    </>
  );
}

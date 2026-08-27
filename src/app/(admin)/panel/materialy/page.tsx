import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listMaterialsForAdmin } from '@/server/repositories/admin-materials';
import { MaterialsDataGrid } from '@/ui/islands/admin/MaterialsDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminMaterialsPage() {
  const materials = await listMaterialsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.materialsHeadingPl}
        <Link href="/panel/materialy/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.materialsNewPl}
          </Button>
        </Link>
      </Typography>

      {materials.length === 0 ? (
        <EmptyState message={ADMIN.materialsEmptyPl} actionLabel={ADMIN.materialsNewPl} actionHref="/panel/materialy/nowy" />
      ) : (
        <MaterialsDataGrid rows={materials} />
      )}
    </>
  );
}

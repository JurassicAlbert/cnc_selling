import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listFinishesForAdmin } from '@/server/repositories/admin-finishes';
import { FinishesDataGrid } from '@/ui/islands/admin/FinishesDataGrid';

export default async function AdminFinishesPage() {
  const finishes = await listFinishesForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.finishesHeadingPl}
        <Link href="/panel/wykonczenia/nowe" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.finishesNewPl}
          </Button>
        </Link>
      </Typography>

      {finishes.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.finishesEmptyPl}</Typography>
      ) : (
        <FinishesDataGrid rows={finishes} />
      )}
    </>
  );
}

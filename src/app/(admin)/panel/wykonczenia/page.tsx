import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listFinishesForAdmin } from '@/server/repositories/admin-finishes';
import { FinishesDataGrid } from '@/ui/islands/admin/FinishesDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

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
        <EmptyState message={ADMIN.finishesEmptyPl} actionLabel={ADMIN.finishesNewPl} actionHref="/panel/wykonczenia/nowe" />
      ) : (
        <FinishesDataGrid rows={finishes} />
      )}
    </>
  );
}

import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listStaticPagesForAdmin } from '@/server/repositories/admin-static-pages';
import { StaticPagesDataGrid } from '@/ui/islands/admin/StaticPagesDataGrid';

export default async function AdminStaticPagesPage() {
  const pages = await listStaticPagesForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.staticPagesHeadingPl}
        <Link href="/panel/strony/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.staticPagesNewPl}
          </Button>
        </Link>
      </Typography>

      {pages.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.staticPagesEmptyPl}</Typography>
      ) : (
        <StaticPagesDataGrid rows={pages} />
      )}
    </>
  );
}

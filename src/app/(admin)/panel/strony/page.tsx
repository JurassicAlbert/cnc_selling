import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listStaticPagesForAdmin } from '@/server/repositories/admin-static-pages';

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
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.staticPagesColumnTitlePl}</TableCell>
              <TableCell>{ADMIN.staticPagesColumnSlugPl}</TableCell>
              <TableCell>{ADMIN.staticPagesColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id} hover>
                <TableCell>
                  <Link href={`/panel/strony/${page.id}`}>{page.titlePl}</Link>
                </TableCell>
                <TableCell>{page.slug}</TableCell>
                <TableCell>
                  <Chip size="small" label={page.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={page.isActive ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

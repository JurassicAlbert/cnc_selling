import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCollectionsForAdmin } from '@/server/repositories/admin-designs';

export default async function AdminCollectionsPage() {
  const collections = await listCollectionsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.collectionsHeadingPl}
        <Link href="/panel/kolekcje/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.collectionsNewPl}
          </Button>
        </Link>
      </Typography>

      {collections.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.collectionsEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.collectionsColumnNamePl}</TableCell>
              <TableCell align="right">{ADMIN.collectionsColumnDesignsPl}</TableCell>
              <TableCell>{ADMIN.collectionsColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {collections.map((collection) => (
              <TableRow key={collection.id} hover>
                <TableCell>
                  <Link href={`/panel/kolekcje/${collection.id}`}>{collection.namePl}</Link>
                </TableCell>
                <TableCell align="right">{collection.designCount}</TableCell>
                <TableCell>
                  <Chip size="small" label={collection.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={collection.isActive ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

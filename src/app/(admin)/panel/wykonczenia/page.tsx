import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminFinishKindLabel } from '@/content/pl/admin';
import { listFinishesForAdmin } from '@/server/repositories/admin-finishes';

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
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.finishesColumnNamePl}</TableCell>
              <TableCell>{ADMIN.finishesColumnKindPl}</TableCell>
              <TableCell>{ADMIN.finishesColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {finishes.map((finish) => (
              <TableRow key={finish.id} hover>
                <TableCell>
                  <Link href={`/panel/wykonczenia/${finish.id}`}>{finish.namePl}</Link>
                </TableCell>
                <TableCell>{adminFinishKindLabel(finish.kind)}</TableCell>
                <TableCell>
                  <Chip size="small" label={finish.isAvailable ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={finish.isAvailable ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

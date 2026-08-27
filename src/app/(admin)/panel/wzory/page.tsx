import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminDesignRightsStatusLabel } from '@/content/pl/admin';
import { listDesignsForAdmin } from '@/server/repositories/admin-designs';

const SELLABLE_RIGHTS = new Set(['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN']);

export default async function AdminDesignsPage() {
  const designs = await listDesignsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.designsHeadingPl}
        <Link href="/panel/wzory/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.designsNewPl}
          </Button>
        </Link>
      </Typography>

      {designs.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.designsEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.designsColumnCodePl}</TableCell>
              <TableCell>{ADMIN.designsColumnNamePl}</TableCell>
              <TableCell>{ADMIN.designsColumnRightsPl}</TableCell>
              <TableCell>{ADMIN.designsColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {designs.map((design) => (
              <TableRow key={design.id} hover>
                <TableCell>
                  <Link href={`/panel/wzory/${design.id}`}>{design.code}</Link>
                </TableCell>
                <TableCell>{design.namePl}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={adminDesignRightsStatusLabel(design.rightsStatus)}
                    color={SELLABLE_RIGHTS.has(design.rightsStatus) ? 'success' : 'warning'}
                  />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={design.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={design.isActive ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

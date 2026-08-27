import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminMaterialFamilyLabel } from '@/content/pl/admin';
import { listMaterialsForAdmin } from '@/server/repositories/admin-materials';

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
        <Typography color="text.secondary">{ADMIN.materialsEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.materialsColumnNamePl}</TableCell>
              <TableCell>{ADMIN.materialsColumnFamilyPl}</TableCell>
              <TableCell>{ADMIN.materialsColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id} hover>
                <TableCell>
                  <Link href={`/panel/materialy/${material.id}`}>{material.namePl}</Link>
                </TableCell>
                <TableCell>{adminMaterialFamilyLabel(material.family)}</TableCell>
                <TableCell>
                  <Chip size="small" label={material.isAvailable ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={material.isAvailable ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCategoriesForAdmin } from '@/server/repositories/admin-categories';

export default async function AdminCategoriesPage() {
  const categories = await listCategoriesForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.categoriesHeadingPl}
        <Link href="/panel/kategorie/nowa" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.categoriesNewPl}
          </Button>
        </Link>
      </Typography>

      {categories.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.categoriesEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.categoriesColumnNamePl}</TableCell>
              <TableCell>{ADMIN.categoriesColumnSlugPl}</TableCell>
              <TableCell align="right">{ADMIN.categoriesColumnProductsPl}</TableCell>
              <TableCell>{ADMIN.categoriesColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id} hover>
                <TableCell>
                  <Link href={`/panel/kategorie/${category.id}`}>{category.namePl}</Link>
                </TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell align="right">{category.productCount}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={category.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl}
                    color={category.isActive ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

import Link from 'next/link';
import { Button, Chip, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';

import { ADMIN, adminProductTypeLabel } from '@/content/pl/admin';
import { listCategoryOptionsForAdmin, listProductsForAdmin } from '@/server/repositories/admin-products';
import type { ProductTypeCode } from '@/generated/prisma/enums';

const PRODUCT_TYPES: readonly ProductTypeCode[] = [
  'WALL_ART',
  'TABLE_TOP',
  'KITCHEN_TILE',
  'FLOOR_ELEMENT',
  'CUSTOM',
  'LOFT_FURNITURE',
  'JEWELRY',
];

type ProductsPageProps = {
  readonly searchParams: Promise<{ readonly categoryId?: string; readonly typeCode?: string }>;
};

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const categoryId = params.categoryId !== undefined && params.categoryId.length > 0 ? params.categoryId : undefined;
  const typeCode = isProductType(params.typeCode) ? params.typeCode : undefined;

  const [products, categories] = await Promise.all([
    listProductsForAdmin({ categoryId, typeCode }),
    listCategoryOptionsForAdmin(),
  ]);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.productsHeadingPl}
        <Link href="/panel/produkty/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.productsNewPl}
          </Button>
        </Link>
      </Typography>

      <form style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <TextField select name="categoryId" label={ADMIN.productsFilterCategoryPl} defaultValue={categoryId ?? ''} size="small" sx={{ minWidth: 200 }}>
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.namePl}
            </MenuItem>
          ))}
        </TextField>
        <TextField select name="typeCode" label={ADMIN.productsFilterTypePl} defaultValue={typeCode ?? ''} size="small" sx={{ minWidth: 220 }}>
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {PRODUCT_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {adminProductTypeLabel(t)}
            </MenuItem>
          ))}
        </TextField>
        <button type="submit" style={{ alignSelf: 'flex-end' }}>
          {ADMIN.ordersFilterApplyPl}
        </button>
      </form>

      {products.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.productsEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.productsColumnNamePl}</TableCell>
              <TableCell>{ADMIN.productsColumnSlugPl}</TableCell>
              <TableCell>{ADMIN.productsColumnCategoryPl}</TableCell>
              <TableCell>{ADMIN.productsColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} hover>
                <TableCell>
                  <Link href={`/panel/produkty/${product.id}`}>{product.namePl}</Link>
                </TableCell>
                <TableCell>{product.slug}</TableCell>
                <TableCell>{product.categoryNamePl}</TableCell>
                <TableCell>
                  <Chip size="small" label={product.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={product.isActive ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function isProductType(value: string | undefined): value is ProductTypeCode {
  return value !== undefined && (PRODUCT_TYPES as readonly string[]).includes(value);
}

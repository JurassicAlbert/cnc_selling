import Link from 'next/link';
import { Button, MenuItem, TextField, Typography } from '@mui/material';

import { ADMIN, adminProductTypeLabel } from '@/content/pl/admin';
import { listCategoryOptionsForAdmin, listProductsForAdmin } from '@/server/repositories/admin-products';
import { ProductsDataGrid } from '@/ui/islands/admin/ProductsDataGrid';
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
        <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-end' }}>
          {ADMIN.ordersFilterApplyPl}
        </Button>
      </form>

      {products.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.productsEmptyPl}</Typography>
      ) : (
        <ProductsDataGrid rows={products} />
      )}
    </>
  );
}

function isProductType(value: string | undefined): value is ProductTypeCode {
  return value !== undefined && (PRODUCT_TYPES as readonly string[]).includes(value);
}

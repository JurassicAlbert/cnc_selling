import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Divider, Stack, Typography } from '@mui/material';

import { ADMIN, WAREHOUSE } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { requireStaffSession } from '@/server/auth/session';
import { findMaterialStock } from '@/server/repositories/material-stock';
import { reportWhatFitsOnBoard } from '@/server/stock/what-fits';
import { StockBatchForm } from '@/ui/islands/admin/StockBatchForm';
import { BoardYieldGrid } from '@/ui/primitives/BoardYieldGrid';

type WarehouseMaterialPageProps = {
  readonly params: Promise<{ readonly materialId: string }>;
};

/**
 * One material's shelf, and the answer to the question the owner actually
 * asked: given a board of these dimensions, which catalogue items can we make
 * from it, and what does the material for each really cost.
 *
 * Every batch gets its own yield grid rather than one grid for the material,
 * because the answer genuinely depends on the board: a 2000 x 1250 sheet and
 * a 600 x 400 offcut of the same oak make different things.
 */
export default async function WarehouseMaterialPage({ params }: WarehouseMaterialPageProps) {
  await requireStaffSession();
  const { materialId } = await params;
  const stock = await findMaterialStock(materialId);
  if (stock === null) {
    notFound();
  }

  // One report per batch. Sequential rather than parallel on purpose: this is
  // a staff screen with a handful of batches, and a `Promise.all` over an
  // unbounded list of catalogue sweeps is how a panel page starts timing out
  // once the shelf is full.
  const reports = [];
  for (const batch of stock.batches) {
    reports.push({ batch, report: await reportWhatFitsOnBoard(materialId, batch) });
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {WAREHOUSE.detailHeadingPl} {stock.materialNamePl}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        <Link href="/panel/magazyn">{WAREHOUSE.headingPl}</Link>
        {' · '}
        {WAREHOUSE.columnChargedPerM2Pl}: {formatPln(stock.chargedPerM2Grosze)}
      </Typography>

      <Typography variant="h6" sx={{ mb: 2 }}>
        {WAREHOUSE.addBatchHeadingPl}
      </Typography>
      <StockBatchForm materialId={materialId} />

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        {WAREHOUSE.batchesHeadingPl}
      </Typography>

      {stock.batches.length === 0 ? (
        <Typography color="text.secondary">{WAREHOUSE.batchEmptyPl}</Typography>
      ) : (
        <Stack spacing={4}>
          {reports.map(({ batch, report }) => (
            <section key={batch.id}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: 'baseline', flexWrap: 'wrap', mb: 1 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {batch.widthMm} x {batch.heightMm} x {batch.thicknessMm} mm
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {WAREHOUSE.batchQuantityPl}: {batch.quantity}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {WAREHOUSE.batchPricePl}: {formatPln(batch.purchasePriceGrosze)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {WAREHOUSE.columnCostPerM2Pl}: {formatPln(batch.costPerM2Grosze)}
                </Typography>
                {batch.supplierNamePl !== null && (
                  <Typography variant="body2" color="text.secondary">
                    {WAREHOUSE.batchSupplierPl}:{' '}
                    {batch.supplierUrl === null ? (
                      batch.supplierNamePl
                    ) : (
                      <a href={batch.supplierUrl} target="_blank" rel="noreferrer noopener">
                        {batch.supplierNamePl}
                      </a>
                    )}
                  </Typography>
                )}
              </Stack>
              {batch.notePl !== null && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {batch.notePl}
                </Typography>
              )}

              {report === null ? null : <BoardYieldGrid report={report} />}
            </section>
          ))}
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4 }}>
        {ADMIN.navWarehousePl}
      </Typography>
    </>
  );
}

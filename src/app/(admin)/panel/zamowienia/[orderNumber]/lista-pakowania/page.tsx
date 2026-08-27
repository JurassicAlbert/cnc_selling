import { notFound } from 'next/navigation';
import { Alert, Divider, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { findOrderForAdmin } from '@/server/repositories/admin-orders';
import { PrintButton } from '@/ui/islands/admin/PrintButton';

type PackingListPageProps = {
  readonly params: Promise<{ readonly orderNumber: string }>;
};

/**
 * A real, physical-pieces-to-box checklist for whoever packs a shipment —
 * `docs/CHECKLIST.md`'s other, still-open "print view" alongside the
 * production brief (`karta-produkcyjna`, which this page deliberately
 * mirrors the shape of: same `findOrderForAdmin` data source, same
 * "not a real X" honesty banner, same `PrintButton`). Distinct purpose,
 * though: the brief tells production what to *make*; this tells the
 * warehouse what to *put in the box and where it's going*.
 */
export default async function AdminPackingListPage({ params }: PackingListPageProps) {
  const { orderNumber } = await params;
  const order = await findOrderForAdmin(decodeURIComponent(orderNumber));
  if (order === null) {
    notFound();
  }

  const rows = order.items.map((item) => ({
    productNamePl: item.snapshot.productNamePl,
    designCode: item.snapshot.designCode,
    materialNamePl: item.snapshot.materialNamePl,
    finishNamePl: item.snapshot.finishNamePl,
    widthMm: item.snapshot.widthMm,
    heightMm: item.snapshot.heightMm,
    personalizationText: item.snapshot.personalizationText,
    quantity: item.quantity,
    // Each physical piece the packer must find and box — a multi-module
    // product (e.g. a 2x2 panel) is several separate boards per unit.
    pieceCount: item.quantity * item.snapshot.moduleLayout.totalModules,
  }));
  const totalPieces = rows.reduce((sum, row) => sum + row.pieceCount, 0);

  return (
    <>
      <Alert severity="warning" sx={{ mb: 2, '@media print': { display: 'none' } }}>
        {ADMIN.packingListNotAShippingLabelPl}
      </Alert>

      <Typography variant="h5" sx={{ mb: 1 }}>
        {ADMIN.packingListHeadingPl}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {ADMIN.packingListNotAShippingLabelPl}
      </Typography>

      <Typography>
        {ADMIN.productionBriefOrderLabelPl}: {order.orderNumber}
      </Typography>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {ADMIN.packingListRecipientHeadingPl}
      </Typography>
      <Typography>
        {order.firstName} {order.lastName}
        {order.companyName !== null && ` (${order.companyName})`}
      </Typography>
      <Typography>
        {order.street}, {order.postalCode} {order.city}
      </Typography>
      {order.phone !== null && <Typography>{order.phone}</Typography>}

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {ADMIN.packingListItemsHeadingPl}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{ADMIN.packingListColumnItemPl}</TableCell>
            <TableCell>{ADMIN.packingListColumnDetailsPl}</TableCell>
            <TableCell align="right">{ADMIN.packingListColumnQuantityPl}</TableCell>
            <TableCell align="center">{ADMIN.packingListColumnCheckPl}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order-item list from an immutable snapshot, never reordered
            <TableRow key={index}>
              <TableCell>
                {row.productNamePl}
                {row.designCode !== null && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {row.designCode}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {[
                  row.materialNamePl,
                  row.finishNamePl,
                  row.widthMm !== null && row.heightMm !== null ? `${row.widthMm} × ${row.heightMm} mm` : null,
                  row.personalizationText !== null ? `„${row.personalizationText}"` : null,
                ]
                  .filter((part): part is string => part !== null)
                  .join(' · ')}
              </TableCell>
              <TableCell align="right">{row.pieceCount}</TableCell>
              <TableCell align="center" sx={{ fontSize: '1.1em' }}>
                ☐
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography sx={{ mt: 2, fontWeight: 600 }}>
        {ADMIN.packingListTotalPiecesPl}: {totalPieces}
      </Typography>

      <Typography sx={{ mt: 4 }}>{ADMIN.packingListPackedByLabelPl}: ______________________________</Typography>

      <Divider sx={{ my: 2 }} />
      <PrintButton label={ADMIN.productionBriefPrintPl} />
    </>
  );
}

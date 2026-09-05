import Image from 'next/image';
import Link from 'next/link';
import { Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, WAREHOUSE } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { requireStaffSession } from '@/server/auth/session';
import { listMaterialStockSummaries } from '@/server/repositories/material-stock';

/**
 * The warehouse index. Owner request, 2026-09-04: "save materials what we
 * have on magazine, have link with pages for each material, so we can tell
 * how much we need to pay for material".
 *
 * `requireStaffSession`, not admin: an operator needs to see what is on the
 * shelf. Writing a batch is ADMIN, because that is where purchase prices and
 * suppliers are recorded - see `operations/admin-material-stock.ts`.
 *
 * The margin column is the reason this screen exists. Until now the shop knew
 * what it charged per square metre and had no record at all of what it paid,
 * so "are we selling this at a loss" was unanswerable.
 */
export default async function WarehousePage() {
  await requireStaffSession();
  const summaries = await listMaterialStockSummaries();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {WAREHOUSE.headingPl}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        {WAREHOUSE.introPl}
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{WAREHOUSE.columnMaterialPl}</TableCell>
            <TableCell align="right">{WAREHOUSE.columnBoardsPl}</TableCell>
            <TableCell align="right">{WAREHOUSE.columnStockValuePl}</TableCell>
            <TableCell align="right">{WAREHOUSE.columnCostPerM2Pl}</TableCell>
            <TableCell align="right">{WAREHOUSE.columnChargedPerM2Pl}</TableCell>
            <TableCell align="right">{WAREHOUSE.columnMarginPl}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {summaries.map((row) => (
            <TableRow key={row.materialId} hover>
              <TableCell>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Image
                    src={row.materialImageUrl}
                    alt=""
                    width={40}
                    height={40}
                    sizes="40px"
                    style={{ borderRadius: 4, objectFit: 'cover' }}
                  />
                  <Link href={`/panel/magazyn/${row.materialId}`}>{row.materialNamePl}</Link>
                  {!row.isAvailable && <Chip size="small" label={ADMIN.inactiveLabelPl} />}
                </Stack>
              </TableCell>
              <TableCell align="right">
                {/*
                  WAREHOUSE-01: what is left, out of what was bought. The
                  remainder is fractional because consumption is measured by
                  area - a board with two coasters cut from it is not a used
                  board - so it is shown to one decimal rather than rounded to
                  a whole, which would read as a used board it is not.
                */}
                {row.boardsHeld > 0
                  ? WAREHOUSE.boardsRemainingOfHeldPl(row.boardsRemaining.toFixed(1), row.boardsHeld)
                  : WAREHOUSE.noStockPl}
              </TableCell>
              <TableCell align="right">{formatPln(row.stockValueGrosze)}</TableCell>
              <TableCell align="right">
                {row.averageCostPerM2Grosze === null ? '-' : formatPln(row.averageCostPerM2Grosze)}
              </TableCell>
              <TableCell align="right">{formatPln(row.chargedPerM2Grosze)}</TableCell>
              <TableCell align="right">
                {row.marginBp === null ? (
                  <Typography variant="body2" color="text.secondary">
                    {WAREHOUSE.marginUnknownPl}
                  </Typography>
                ) : (
                  <Chip
                    size="small"
                    // Red is not decoration here: selling below the purchase
                    // price is the single state this screen exists to surface,
                    // and it must not read like any other number.
                    color={row.marginBp < 0 ? 'error' : 'success'}
                    label={`${(row.marginBp / 100).toFixed(1)}%`}
                    title={row.marginBp < 0 ? WAREHOUSE.marginNegativeNotePl : undefined}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { OrderModuleManifestItem } from '@/server/repositories/admin-production';

/** "Module manifest" (§16A.1 module 2/10) — one table per order item, listing its real `ModuleSpec` rows from the immutable snapshot. Used on both the admin order detail page and the printable production brief. */
export function OrderModuleManifest({ items }: { readonly items: readonly OrderModuleManifestItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order-item list from an immutable snapshot, never reordered
        <div key={index} style={{ marginBottom: 16 }}>
          <Typography variant="subtitle2">{item.productNamePl}</Typography>
          {item.modules.length <= 1 ? (
            <Typography color="text.secondary" variant="body2">
              {ADMIN.orderManifestEmptyPl}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{ADMIN.orderManifestColumnCodePl}</TableCell>
                  <TableCell>{ADMIN.orderManifestColumnSizePl}</TableCell>
                  <TableCell align="right">{ADMIN.orderManifestColumnOrderPl}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {item.modules.map((module) => (
                  <TableRow key={module.code}>
                    <TableCell>{module.code}</TableCell>
                    <TableCell>
                      {module.widthMm} × {module.heightMm}
                    </TableCell>
                    <TableCell align="right">{module.productionOrder}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </>
  );
}

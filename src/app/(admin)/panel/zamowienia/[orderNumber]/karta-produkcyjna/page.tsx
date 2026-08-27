import { notFound } from 'next/navigation';
import { Alert, Divider, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { findOrderForAdmin } from '@/server/repositories/admin-orders';
import { PrintButton } from '@/ui/islands/admin/PrintButton';

type ProductionBriefPageProps = {
  readonly params: Promise<{ readonly orderNumber: string }>;
};

export default async function AdminProductionBriefPage({ params }: ProductionBriefPageProps) {
  const { orderNumber } = await params;
  const order = await findOrderForAdmin(decodeURIComponent(orderNumber));
  if (order === null) {
    notFound();
  }

  return (
    <>
      <Alert severity="warning" sx={{ mb: 2, '@media print': { display: 'none' } }}>
        {ADMIN.productionBriefNotAFilePl}
      </Alert>

      <Typography variant="h5" sx={{ mb: 1 }}>
        {ADMIN.productionBriefHeadingPl}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {ADMIN.productionBriefNotAFilePl}
      </Typography>

      <Typography>
        {ADMIN.productionBriefOrderLabelPl}: {order.orderNumber}
      </Typography>

      {order.items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order-item list from an immutable snapshot, never reordered
        <div key={index}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">
            {ADMIN.productionBriefProductLabelPl}: {item.snapshot.productNamePl}
          </Typography>
          {item.snapshot.designCode !== null && (
            <Typography>
              {ADMIN.productionBriefDesignLabelPl}: {item.snapshot.designCode}
            </Typography>
          )}
          {item.snapshot.materialNamePl !== null && (
            <Typography>
              {ADMIN.productionBriefMaterialLabelPl}: {item.snapshot.materialNamePl}
            </Typography>
          )}
          {item.snapshot.finishNamePl !== null && (
            <Typography>
              {ADMIN.productionBriefFinishLabelPl}: {item.snapshot.finishNamePl}
            </Typography>
          )}
          {item.snapshot.widthMm !== null && item.snapshot.heightMm !== null && (
            <Typography>
              {ADMIN.productionBriefSizeLabelPl}: {item.snapshot.widthMm} × {item.snapshot.heightMm} mm
            </Typography>
          )}
          {item.snapshot.thicknessMm !== null && (
            <Typography>
              {ADMIN.productionBriefThicknessLabelPl}: {item.snapshot.thicknessMm} mm
            </Typography>
          )}
          {item.snapshot.personalizationText !== null && (
            <Typography>
              {ADMIN.productionBriefPersonalizationLabelPl}: „{item.snapshot.personalizationText}"
            </Typography>
          )}

          {item.snapshot.moduleLayout.totalModules > 1 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {ADMIN.productionBriefModulesHeadingPl}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{ADMIN.orderManifestColumnCodePl}</TableCell>
                    <TableCell>{ADMIN.orderManifestColumnSizePl}</TableCell>
                    <TableCell align="right">{ADMIN.orderManifestColumnOrderPl}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {item.snapshot.moduleLayout.modules.map((module) => (
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
            </>
          )}
        </div>
      ))}

      <Divider sx={{ my: 2 }} />
      <PrintButton label={ADMIN.productionBriefPrintPl} />
    </>
  );
}

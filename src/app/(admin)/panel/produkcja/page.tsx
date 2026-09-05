import Link from 'next/link';
import { LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { PRODUCTION_STATUSES, getProductionCapacity, listProductionQueue } from '@/server/repositories/admin-production';
import type { OrderStatus } from '@/generated/prisma/enums';

export default async function AdminProductionPage() {
  const [queue, capacity] = await Promise.all([listProductionQueue(), getProductionCapacity()]);
  const hasCapacityConfigured = capacity.weeklyCapacityMinutes > 0;
  const capacityPercent = hasCapacityConfigured
    ? Math.round((capacity.queuedMachineMinutes / capacity.weeklyCapacityMinutes) * 100)
    : null;

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.productionHeadingPl}
      </Typography>

      <Typography variant="subtitle2">{ADMIN.productionCapacityAreaLabelPl}</Typography>
      <Typography sx={{ mb: 2 }}>{capacity.queuedAreaM2.toFixed(2)} m²</Typography>

      <Typography variant="subtitle2">{ADMIN.productionCapacityMinutesLabelPl}</Typography>
      <Typography sx={{ mb: 1 }}>{Math.round(capacity.queuedMachineMinutes)} min</Typography>

      {hasCapacityConfigured ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {ADMIN.productionCapacityWeeklyLabelPl}: {capacity.weeklyCapacityMinutes} min ({capacityPercent}%)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, capacityPercent ?? 0)}
            color={(capacityPercent ?? 0) > 100 ? 'error' : 'primary'}
            sx={{ mb: 4, maxWidth: 400 }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {ADMIN.productionCapacityUnconfiguredPl}
        </Typography>
      )}

      {PRODUCTION_STATUSES.map((status) => (
        <ProductionSection key={status} status={status} orders={queue.filter((order) => order.status === status)} />
      ))}
    </>
  );
}

function ProductionSection({
  status,
  orders,
}: {
  readonly status: OrderStatus;
  readonly orders: readonly { readonly orderNumber: string; readonly customerName: string; readonly moduleCount: number; readonly areaM2: number }[];
}) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {adminOrderStatusLabel(status)}
      </Typography>
      {orders.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {ADMIN.productionQueueEmptyPl}
        </Typography>
      ) : (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.productionColumnOrderPl}</TableCell>
              <TableCell>{ADMIN.productionColumnCustomerPl}</TableCell>
              <TableCell align="right">{ADMIN.productionColumnModulesPl}</TableCell>
              <TableCell align="right">{ADMIN.productionColumnAreaPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.orderNumber} hover>
                <TableCell>
                  <Link href={`/panel/zamowienia/${encodeURIComponent(order.orderNumber)}`}>{order.orderNumber}</Link>
                </TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell align="right">{order.moduleCount}</TableCell>
                <TableCell align="right">{order.areaM2.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

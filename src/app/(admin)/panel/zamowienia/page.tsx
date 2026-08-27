import Link from 'next/link';
import {
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { ORDER_STATUSES } from '@/domain/order-status/transitions';
import { listOrdersForAdmin } from '@/server/repositories/admin-orders';
import type { OrderStatus, PaymentStatus } from '@/generated/prisma/enums';

const PAYMENT_STATUSES: readonly PaymentStatus[] = ['AWAITING', 'UNDERPAID', 'PAID', 'REFUNDED'];

type OrdersPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string;
    readonly paymentStatus?: string;
    readonly search?: string;
  }>;
};

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const status = isOrderStatus(params.status) ? params.status : undefined;
  const paymentStatus = isPaymentStatus(params.paymentStatus) ? params.paymentStatus : undefined;
  const search = params.search !== undefined && params.search.length > 0 ? params.search : undefined;

  const orders = await listOrdersForAdmin({ status, paymentStatus, search });

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.ordersHeadingPl}
      </Typography>

      <form style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <TextField select name="status" label={ADMIN.ordersFilterStatusPl} defaultValue={status ?? ''} size="small" sx={{ minWidth: 200 }}>
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {ORDER_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {adminOrderStatusLabel(s)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          name="paymentStatus"
          label={ADMIN.ordersFilterPaymentStatusPl}
          defaultValue={paymentStatus ?? ''}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {PAYMENT_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField name="search" label={ADMIN.ordersFilterSearchPl} defaultValue={search ?? ''} size="small" sx={{ minWidth: 240 }} />
        <button type="submit" style={{ alignSelf: 'flex-end' }}>
          {ADMIN.ordersFilterApplyPl}
        </button>
      </form>

      {orders.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.ordersEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.ordersColumnNumberPl}</TableCell>
              <TableCell>{ADMIN.ordersColumnCustomerPl}</TableCell>
              <TableCell>{ADMIN.ordersColumnStatusPl}</TableCell>
              <TableCell>{ADMIN.ordersColumnPaymentPl}</TableCell>
              <TableCell align="right">{ADMIN.ordersColumnTotalPl}</TableCell>
              <TableCell>{ADMIN.ordersColumnDatePl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.orderNumber} hover>
                <TableCell>
                  <Link href={`/panel/zamowienia/${order.orderNumber}`}>{order.orderNumber}</Link>
                </TableCell>
                <TableCell>
                  {order.customerName}
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    {order.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={adminOrderStatusLabel(order.status)} />
                </TableCell>
                <TableCell>{order.paymentStatus}</TableCell>
                <TableCell align="right">{formatPln(order.totalGrossGrosze)}</TableCell>
                <TableCell>{order.createdAt.toLocaleDateString('pl-PL')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function isOrderStatus(value: string | undefined): value is OrderStatus {
  return value !== undefined && (ORDER_STATUSES as readonly string[]).includes(value);
}

function isPaymentStatus(value: string | undefined): value is PaymentStatus {
  return value !== undefined && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

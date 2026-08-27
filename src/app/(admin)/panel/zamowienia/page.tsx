import { MenuItem, TextField, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { ORDER_STATUSES } from '@/domain/order-status/transitions';
import { listOrdersForAdmin } from '@/server/repositories/admin-orders';
import { OrdersDataGrid } from '@/ui/islands/admin/OrdersDataGrid';
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
        <OrdersDataGrid rows={orders} />
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

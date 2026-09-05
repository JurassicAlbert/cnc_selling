import { Button, MenuItem, TextField, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { ORDER_STATUSES } from '@/domain/order-status/transitions';
import { listOrdersForAdmin } from '@/server/repositories/admin-orders';
import { parsePagination } from '@/domain/pagination/page';
import { AdminPageSummary } from '@/ui/primitives/AdminPageSummary';
import { OrdersDataGrid } from '@/ui/islands/admin/OrdersDataGrid';
import type { OrderStatus, PaymentStatus } from '@/generated/prisma/enums';

const PAYMENT_STATUSES: readonly PaymentStatus[] = ['AWAITING', 'UNDERPAID', 'PAID', 'REFUNDED'];

type OrdersPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string;
    readonly paymentStatus?: string;
    readonly search?: string;
    readonly dateFrom?: string;
    readonly dateTo?: string;
    readonly page?: string;
    readonly perPage?: string;
  }>;
};

/** Same UTC-midnight convention the Dashboard's own date-range form uses (`panel/page.tsx`). */
function parseDateParam(value: string | undefined): Date | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const status = isOrderStatus(params.status) ? params.status : undefined;
  const paymentStatus = isPaymentStatus(params.paymentStatus) ? params.paymentStatus : undefined;
  const search = params.search !== undefined && params.search.length > 0 ? params.search : undefined;
  const dateFrom = parseDateParam(params.dateFrom);
  // End-of-day, so "dateTo" is inclusive of the whole selected day - same
  // reasoning as the Dashboard's own range form.
  const dateToRaw = parseDateParam(params.dateTo);
  const dateTo = dateToRaw === undefined ? undefined : new Date(dateToRaw.getTime() + 24 * 60 * 60 * 1000 - 1);

  // ADMIN-01: the page comes from the URL, so it survives a reload and is
  // shareable, and the filters above the grid page with it.
  const page = parsePagination(params);
  const orders = await listOrdersForAdmin({ status, paymentStatus, search, dateFrom, dateTo }, page);

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
        <TextField
          type="date"
          name="dateFrom"
          label={ADMIN.dashboardDateRangeFromPl}
          defaultValue={params.dateFrom ?? ''}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          name="dateTo"
          label={ADMIN.dashboardDateRangeToPl}
          defaultValue={params.dateTo ?? ''}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-end' }}>
          {ADMIN.ordersFilterApplyPl}
        </Button>
      </form>

      {orders.total === 0 ? (
        <Typography color="text.secondary">{ADMIN.ordersEmptyPl}</Typography>
      ) : (
        <>
          <AdminPageSummary skip={page.skip} take={page.take} total={orders.total} />
          <OrdersDataGrid
            rows={orders.items}
            page={page.pageIndex}
            pageSize={page.pageSize}
            total={orders.total}
          />
        </>
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

import { Button, Grid, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { getProductionCapacity } from '@/server/repositories/admin-production';
import { getDashboardKpis, getOrdersByStatus, getRevenueOverTime, getTopEntities } from '@/server/repositories/admin-dashboard';
import type { TopEntityKind } from '@/server/repositories/admin-dashboard';
import { StatCard } from '@/ui/islands/admin/StatCard';
import { OrdersByStatusChart, RevenueChart, TopEntitiesChart } from '@/ui/islands/admin/DashboardCharts';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

type DashboardPageProps = {
  readonly searchParams: Promise<{ readonly from?: string; readonly to?: string }>;
};

function parseDateParam(value: string | undefined): Date | null {
  if (value === undefined || value.length === 0) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds the "every dashboard number clicks through to the records behind
 * it" hrefs (`docs/CHECKLIST.md`). Date windows here mirror
 * `getDashboardKpis`'s own (today/7d/30d lookback from `now`) closely
 * enough for a click-through — not byte-exact, since the KPI's "today" uses
 * local server time while the Orders list's `dateFrom`/`dateTo` filter
 * parses UTC dates (same convention as this page's own date-range form
 * above); a user landing from the tile still sees the right list with the
 * matching filter visible and adjustable.
 */
function ordersHref(from: Date, to: Date): string {
  const dateParam = (d: Date) => d.toISOString().slice(0, 10);
  return `/panel/zamowienia?dateFrom=${dateParam(from)}&dateTo=${dateParam(to)}`;
}

export default async function AdminDashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);

  const from = parseDateParam(params.from) ?? defaultFrom;
  const toRaw = parseDateParam(params.to) ?? now;
  // End-of-day, so "to" is inclusive of the whole selected day.
  const to = new Date(toRaw);
  to.setHours(23, 59, 59, 999);

  const range = { from, to };
  const topEntityKinds: readonly TopEntityKind[] = ['product', 'design', 'material'];

  const [kpis, revenuePoints, ordersByStatus, topEntitiesByKind, capacity] = await Promise.all([
    getDashboardKpis(now),
    getRevenueOverTime(range),
    getOrdersByStatus(range),
    Promise.all(topEntityKinds.map((kind) => getTopEntities(range, kind))),
    getProductionCapacity(),
  ]);

  const ordersByStatusRecord = Object.fromEntries(ordersByStatus);
  const topEntitiesRecord = Object.fromEntries(topEntityKinds.map((kind, i) => [kind, topEntitiesByKind[i]])) as Record<
    TopEntityKind,
    (typeof topEntitiesByKind)[number]
  >;

  const hasCapacityConfigured = capacity.weeklyCapacityMinutes > 0;
  const capacityPercent = hasCapacityConfigured ? Math.round((capacity.queuedMachineMinutes / capacity.weeklyCapacityMinutes) * 100) : null;

  const ordersTodayHref = ordersHref(now, now);
  const orders7dHref = ordersHref(new Date(now.getTime() - 7 * DAY_MS), now);
  const orders30dHref = ordersHref(defaultFrom, now);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.dashboardHeadingPl}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<TodayOutlinedIcon fontSize="small" />} label={ADMIN.dashboardKpiOrdersTodayPl} value={String(kpis.ordersToday)} color="primary" href={ordersTodayHref} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<DateRangeOutlinedIcon fontSize="small" />} label={ADMIN.dashboardKpiOrders7dPl} value={String(kpis.orders7d)} color="info" href={orders7dHref} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<CalendarMonthOutlinedIcon fontSize="small" />} label={ADMIN.dashboardKpiOrders30dPl} value={String(kpis.orders30d)} color="secondary" href={orders30dHref} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<PaidOutlinedIcon fontSize="small" />} label={ADMIN.dashboardKpiRevenueNetPl} value={formatPln(kpis.revenueNet30dGrosze)} color="success" href={orders30dHref} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
            label={ADMIN.dashboardKpiRevenueGrossPl}
            value={formatPln(kpis.revenueGross30dGrosze)}
            color="success"
            href={orders30dHref}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon={<TrendingUpOutlinedIcon fontSize="small" />}
            label={ADMIN.dashboardKpiAovPl}
            value={formatPln(kpis.averageOrderValueGrosze)}
            color="info"
            href={orders30dHref}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon={<HourglassEmptyOutlinedIcon fontSize="small" />}
            label={ADMIN.dashboardKpiAwaitingPaymentPl}
            value={String(kpis.ordersAwaitingPayment)}
            color="warning"
            href="/panel/zamowienia?paymentStatus=AWAITING"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon={<FactCheckOutlinedIcon fontSize="small" />}
            label={ADMIN.dashboardKpiDesignsAwaitingReviewPl}
            value={String(kpis.designsAwaitingReview)}
            color="warning"
            href="/panel/weryfikacja"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            icon={<PrecisionManufacturingOutlinedIcon fontSize="small" />}
            label={ADMIN.dashboardKpiOrdersInProductionPl}
            value={String(kpis.ordersInProduction)}
            color="primary"
            href="/panel/produkcja"
          />
        </Grid>
      </Grid>

      <form style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField type="date" name="from" label={ADMIN.dashboardDateRangeFromPl} defaultValue={toDateInputValue(from)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" name="to" label={ADMIN.dashboardDateRangeToPl} defaultValue={toDateInputValue(toRaw)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
        <Button type="submit" variant="contained">
          {ADMIN.dashboardDateRangeApplyPl}
        </Button>
      </form>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <RevenueChart points={revenuePoints} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <OrdersByStatusChart counts={ordersByStatusRecord} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TopEntitiesChart byKind={topEntitiesRecord} />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {ADMIN.dashboardProductionLoadTitlePl}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {ADMIN.productionCapacityAreaLabelPl}: {capacity.queuedAreaM2.toFixed(2)} m² · {ADMIN.productionCapacityMinutesLabelPl}: {Math.round(capacity.queuedMachineMinutes)} min
      </Typography>
      {hasCapacityConfigured ? (
        <Stack sx={{ maxWidth: 400, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {ADMIN.productionCapacityWeeklyLabelPl}: {capacity.weeklyCapacityMinutes} min ({capacityPercent}%)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, capacityPercent ?? 0)}
            color={(capacityPercent ?? 0) > 100 ? 'error' : 'primary'}
          />
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {ADMIN.productionCapacityUnconfiguredPl}
        </Typography>
      )}
    </>
  );
}

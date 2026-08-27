'use client';

/**
 * `@mui/x-charts` rendering for the Dashboard — a client component by
 * necessity (interactive SVG charts), fed plain pre-fetched data from the
 * Server Component page (`panel/page.tsx`), same RSC-fetches/client-renders
 * split every other admin data grid in this panel already uses.
 */

import { useState } from 'react';
import { Card, CardContent, Stack, Tab, Tabs, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import type { OrderStatus } from '@/generated/prisma/enums';
import { ORDER_STATUSES } from '@/domain/order-status/transitions';
import type { RevenuePoint, TopEntity, TopEntityKind } from '@/server/repositories/admin-dashboard';

export function RevenueChart({ points }: { readonly points: readonly RevenuePoint[] }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {ADMIN.dashboardRevenueChartTitlePl}
        </Typography>
        <LineChart
          height={280}
          xAxis={[{ scaleType: 'point', data: points.map((p) => p.date), tickLabelStyle: { fontSize: 10 } }]}
          series={[
            {
              data: points.map((p) => p.netGrosze / 100),
              label: ADMIN.dashboardRevenueNetLabelPl,
              valueFormatter: (v) => formatPln(Math.round((v ?? 0) * 100)),
            },
            {
              data: points.map((p) => p.grossGrosze / 100),
              label: ADMIN.dashboardRevenueGrossLabelPl,
              valueFormatter: (v) => formatPln(Math.round((v ?? 0) * 100)),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function OrdersByStatusChart({ counts }: { readonly counts: Readonly<Record<string, number>> }) {
  const statuses = ORDER_STATUSES as readonly OrderStatus[];
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          {ADMIN.dashboardOrdersByStatusChartTitlePl}
        </Typography>
        <BarChart
          height={280}
          xAxis={[{ scaleType: 'band', data: statuses.map((s) => adminOrderStatusLabel(s)), tickLabelStyle: { fontSize: 10, angle: -20 } }]}
          series={[{ data: statuses.map((s) => counts[s] ?? 0), label: ADMIN.dashboardOrdersLabelPl }]}
        />
      </CardContent>
    </Card>
  );
}

const TOP_ENTITY_TABS: readonly { readonly kind: TopEntityKind; readonly labelPl: string }[] = [
  { kind: 'product', labelPl: ADMIN.dashboardTopProductsPl },
  { kind: 'design', labelPl: ADMIN.dashboardTopDesignsPl },
  { kind: 'material', labelPl: ADMIN.dashboardTopMaterialsPl },
];

export function TopEntitiesChart({ byKind }: { readonly byKind: Readonly<Record<TopEntityKind, readonly TopEntity[]>> }) {
  const [activeKind, setActiveKind] = useState<TopEntityKind>('product');
  const activeTabIndex = TOP_ENTITY_TABS.findIndex((t) => t.kind === activeKind);
  const entities = byKind[activeKind];

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1">{ADMIN.dashboardTopEntitiesChartTitlePl}</Typography>
          <Tabs
            value={activeTabIndex}
            onChange={(_e, v) => setActiveKind(TOP_ENTITY_TABS[v as number]?.kind ?? 'product')}
            sx={{ minHeight: 32 }}
          >
            {TOP_ENTITY_TABS.map((t) => (
              <Tab key={t.kind} label={t.labelPl} sx={{ minHeight: 32, py: 0.5 }} />
            ))}
          </Tabs>
        </Stack>
        {entities.length === 0 ? (
          <Typography color="text.secondary">{ADMIN.dashboardTopEntitiesEmptyPl}</Typography>
        ) : (
          <BarChart
            height={280}
            layout="horizontal"
            yAxis={[{ scaleType: 'band', data: entities.map((e) => e.name) }]}
            xAxis={[{ valueFormatter: (v: number) => formatPln(Math.round(v * 100)) }]}
            series={[
              {
                data: entities.map((e) => e.revenueGrosze / 100),
                label: ADMIN.dashboardRevenueGrossLabelPl,
                valueFormatter: (v) => formatPln(Math.round((v ?? 0) * 100)),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip, Grid, Stack, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import { ORDER_STATUSES, checkOrderStatusTransition } from '@/domain/order-status/transitions';
import { findOrderForAdmin } from '@/server/repositories/admin-orders';
import { listOrderModuleManifest } from '@/server/repositories/admin-production';
import { findShipmentForOrder } from '@/server/repositories/admin-shipments';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { OrderEventTimeline } from '@/ui/primitives/OrderEventTimeline';
import { OrderModuleManifest } from '@/ui/primitives/OrderModuleManifest';
import { OrderSummary } from '@/ui/primitives/OrderSummary';
import { OrderStatusActions } from '@/ui/islands/admin/OrderStatusActions';
import type { StatusCandidate } from '@/ui/islands/admin/OrderStatusActions';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';
import { ShipmentEditor } from '@/ui/islands/admin/ShipmentEditor';

type OrderDetailPageProps = {
  readonly params: Promise<{ readonly orderNumber: string }>;
};

export default async function AdminOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderNumber } = await params;
  const decodedOrderNumber = decodeURIComponent(orderNumber);
  const [order, manifest, storeSettings] = await Promise.all([
    findOrderForAdmin(decodedOrderNumber),
    listOrderModuleManifest(decodedOrderNumber),
    getStoreSettings(),
  ]);
  if (order === null) {
    notFound();
  }
  const shipment = await findShipmentForOrder(order.id);

  const candidates: StatusCandidate[] = ORDER_STATUSES.filter((status) => status !== order.status)
    .map((status) => {
      const result = checkOrderStatusTransition({
        fromStatus: order.status,
        toStatus: status,
        actorType: 'staff',
        hasUnapprovedCustomDesign: order.hasUnapprovedCustomDesign,
      });
      if (result.ok) {
        return { status, blockedByDesignReview: false };
      }
      if (result.code === 'DESIGN_REVIEW_GATE_BLOCKED') {
        return { status, blockedByDesignReview: true };
      }
      return null;
    })
    .filter((c): c is StatusCandidate => c !== null);

  const canMarkPaid = order.paymentMethod === 'BANK_TRANSFER' && order.paymentStatus !== 'PAID';

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {order.orderNumber}
      </Typography>
      <Chip size="small" label={adminOrderStatusLabel(order.status)} sx={{ mb: 3 }} />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <OrderSummary order={order} bankDetails={storeSettings} />

          <Typography variant="h6" sx={{ mt: 4 }}>
            {ADMIN.orderBuyerHeadingPl}
          </Typography>
          <Typography>
            {order.firstName} {order.lastName}
            {order.companyName !== null && ` (${order.companyName})`}
          </Typography>
          <Typography>{order.email}</Typography>
          {order.phone !== null && <Typography>{order.phone}</Typography>}
          <Typography>
            {order.street}, {order.postalCode} {order.city}
          </Typography>
          {order.nip !== null && <Typography>NIP: {order.nip}</Typography>}

          <Typography variant="h6" sx={{ mt: 4 }}>
            {ADMIN.orderDeliveryHeadingPl}
          </Typography>
          <Typography>{order.deliveryMethodNamePl}</Typography>
          {order.pickupPointLabel !== null && <Typography color="text.secondary">{order.pickupPointLabel}</Typography>}
          {order.courierNotePl !== null && (
            <Typography sx={{ mt: 0.5 }}>
              {ADMIN.orderCourierNoteLabelPl}: {order.courierNotePl}
            </Typography>
          )}
          {order.internalShipmentNotePl !== null && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {ADMIN.orderInternalShipmentNoteLabelPl}: {order.internalShipmentNotePl}
            </Typography>
          )}

          <Typography variant="h6" sx={{ mt: 4 }}>
            {ADMIN.orderProductionNotesHeadingPl}
          </Typography>
          <Typography color={order.productionNotes === null ? 'text.secondary' : undefined}>
            {order.productionNotes ?? ADMIN.orderProductionNotesEmptyPl}
          </Typography>

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {ADMIN.orderManifestHeadingPl}
          </Typography>
          <OrderModuleManifest items={manifest} />
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <Link href={`/panel/zamowienia/${encodeURIComponent(order.orderNumber)}/karta-produkcyjna`}>{ADMIN.orderBriefLinkPl}</Link>
            <Link href={`/panel/zamowienia/${encodeURIComponent(order.orderNumber)}/lista-pakowania`}>{ADMIN.orderPackingListLinkPl}</Link>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {ADMIN.orderEventsHeadingPl}
          </Typography>
          <OrderEventTimeline events={order.events} />

          <OrderStatusActions orderNumber={order.orderNumber} candidates={candidates} canMarkPaid={canMarkPaid} />

          <ShipmentEditor orderNumber={order.orderNumber} orderId={order.id} shipment={shipment} />

          <RecordActivityTimeline entity="Order" entityId={order.id} />
        </Grid>
      </Grid>
    </>
  );
}

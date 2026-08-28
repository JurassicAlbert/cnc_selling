import { shipmentStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import type { OrderShipmentView } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

/**
 * Customer-facing shipment status — P9 phase 7. Deliberately, explicitly
 * honest about being manually updated: no live carrier polling exists
 * anywhere in this project (§9/§15), and this component says so directly
 * rather than presenting a status that looks automatically fresh.
 */
export function OrderShipmentInfo({ shipment }: { readonly shipment: OrderShipmentView | null }) {
  return (
    <div style={{ marginBlockStart: 24 }}>
      <Heading level={2}>{SITE.orderShipmentHeadingPl}</Heading>

      {shipment === null ? (
        <Text muted>{SITE.orderShipmentNotYetPreparedPl}</Text>
      ) : (
        <div style={{ marginBlockStart: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text>
            {SITE.orderShipmentStatusLabelPl}: {shipmentStatusMessage(shipment.status)}
          </Text>
          {shipment.carrier !== null && (
            <Text muted>
              {SITE.orderShipmentCarrierLabelPl}: {shipment.carrier}
            </Text>
          )}
          {shipment.trackingNumber !== null && (
            <Text muted>
              {SITE.orderShipmentTrackingNumberLabelPl}: {shipment.trackingNumber}
            </Text>
          )}
          {shipment.shippedAt !== null && (
            <Text muted>
              {SITE.orderShipmentShippedAtLabelPl}: {dateFormatter.format(shipment.shippedAt)}
            </Text>
          )}
          {shipment.estimatedDeliveryAt !== null && (
            <Text muted>
              {SITE.orderShipmentEstimatedDeliveryLabelPl}: {dateFormatter.format(shipment.estimatedDeliveryAt)}
            </Text>
          )}
          {shipment.deliveredAt !== null && (
            <Text muted>
              {SITE.orderShipmentDeliveredAtLabelPl}: {dateFormatter.format(shipment.deliveredAt)}
            </Text>
          )}
          {shipment.customerNotesPl !== null && <Text muted>{shipment.customerNotesPl}</Text>}
          {shipment.issueDescriptionPl !== null && (
            <Text muted>
              {SITE.orderShipmentIssueLabelPl}: {shipment.issueDescriptionPl}
            </Text>
          )}
          <Text muted>{SITE.orderShipmentManualNoticePl}</Text>
        </div>
      )}
    </div>
  );
}

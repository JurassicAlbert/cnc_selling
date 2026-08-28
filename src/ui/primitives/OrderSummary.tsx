import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import type { OrderConfirmationView } from '@/server/repositories/orders';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

/**
 * The items/total/payment-instructions block shared by the guest
 * order-confirmation page (`(shop)/zamowienie/[orderNumber]/page.tsx`) and
 * the logged-in order-history detail page
 * (`(shop)/moje-konto/zamowienia/[orderNumber]/page.tsx`) — same
 * `OrderConfirmationView` shape, same display, extracted once a second real
 * caller needed it rather than duplicated.
 */
export type OrderSummaryBankDetails = {
  readonly bankAccountNumber: string | null;
  readonly bankAccountHolderPl: string | null;
};

/**
 * Only the fields this component actually reads — deliberately narrower
 * than `OrderConfirmationView` so a field added there for one caller (e.g.
 * P9 phase 7's `shipment`) never forces every other caller's own view type
 * (`AdminOrderView` here) to grow a matching field it has no use for.
 */
type OrderSummaryOrderView = Pick<OrderConfirmationView, 'orderNumber' | 'paymentMethod' | 'totalGrossGrosze' | 'items'>;

export function OrderSummary({
  order,
  bankDetails,
}: {
  readonly order: OrderSummaryOrderView;
  readonly bankDetails: OrderSummaryBankDetails;
}) {
  return (
    <>
      <div style={{ marginBlockStart: 24 }}>
        <Heading level={2}>{SITE.orderItemsHeadingPl}</Heading>
        <div style={{ marginBlockStart: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {order.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an immutable order snapshot, never reordered or edited
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text muted>
                {item.snapshot.productNamePl} × {item.quantity}
                {item.snapshot.materialNamePl !== null || item.snapshot.designNamePl !== null
                  ? ` — ${[item.snapshot.materialNamePl, item.snapshot.designNamePl].filter((v) => v !== null).join(', ')}`
                  : ''}
              </Text>
              <Text muted>{formatPln(item.lineGrossGrosze)}</Text>
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            font: 'var(--mui-font-h5)',
            paddingBlockStart: 8,
            marginBlockStart: 8,
            borderTop: '1px solid var(--mui-palette-divider)',
          }}
        >
          <span>{SITE.orderTotalLabelPl}</span>
          <span>{formatPln(order.totalGrossGrosze)}</span>
        </div>
      </div>

      {order.paymentMethod === 'BANK_TRANSFER' ? (
        <div style={{ marginBlockStart: 24 }}>
          <Heading level={2}>{SITE.orderBankTransferHeadingPl}</Heading>
          <Text>
            {SITE.orderBankTransferTitlePl}: {order.orderNumber}
          </Text>
          {bankDetails.bankAccountNumber !== null ? (
            <>
              <Text>
                {SITE.orderBankTransferAccountLabelPl}: {bankDetails.bankAccountNumber}
              </Text>
              {bankDetails.bankAccountHolderPl !== null && <Text muted>{bankDetails.bankAccountHolderPl}</Text>}
            </>
          ) : (
            <Text muted>{SITE.orderBankTransferAccountPendingPl}</Text>
          )}
        </div>
      ) : (
        <div style={{ marginBlockStart: 24 }}>
          <Text>{SITE.orderContactArrangedNoticePl}</Text>
        </div>
      )}
    </>
  );
}

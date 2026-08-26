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
export function OrderSummary({ order }: { readonly order: OrderConfirmationView }) {
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
          <Text muted>{SITE.orderBankTransferAccountPendingPl}</Text>
        </div>
      ) : (
        <div style={{ marginBlockStart: 24 }}>
          <Text>{SITE.orderContactArrangedNoticePl}</Text>
        </div>
      )}
    </>
  );
}

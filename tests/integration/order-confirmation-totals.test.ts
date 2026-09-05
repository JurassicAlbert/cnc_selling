/**
 * `docs/AI-CHECKLIST.md` BUG-04 / T-06 - "Σ item lines + shipping ===
 * `totalGrossGrosze`".
 *
 * `Order` stores `subtotalNetGrosze`, `vatGrosze`, `shippingGrosze` and
 * `totalGrossGrosze`. `OrderConfirmationView` exposed only the last one, and
 * `OrderSummary` rendered each item's line total, a divider, then „Razem"
 * with the grand total. So the confirmation listed lines that do not add up
 * to the number underneath them and never said why: for a paid-delivery
 * order the arithmetic is wrong on its face, and for a free-delivery order
 * the customer is never told delivery was free.
 *
 * The checkout page already breaks this out correctly. The information was
 * being lost at exactly the moment it became the permanent record - the
 * document the customer keeps and pays from.
 *
 * What is pinned here is the reconciliation itself, at the boundary the
 * confirmation page actually reads. A test that only checked "the field is
 * present" would pass against a view that returned a plausible-looking wrong
 * number; this one fails unless the parts genuinely sum to the whole.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { findOrderForConfirmation } from '@/server/repositories/orders';

const PREFIX = 'test-order-totals-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

type Line = { readonly net: number; readonly vat: number };

async function seedOrder(params: {
  readonly lines: readonly Line[];
  readonly shippingGrosze: number;
}): Promise<{ readonly orderNumber: string; readonly accessToken: string; readonly total: number }> {
  const subtotalNetGrosze = params.lines.reduce((sum, line) => sum + line.net, 0);
  const vatGrosze = params.lines.reduce((sum, line) => sum + line.vat, 0);
  const totalGrossGrosze = subtotalNetGrosze + vatGrosze + params.shippingGrosze;

  const orderNumber = uid();
  const accessToken = uid();

  await prisma.order.create({
    data: {
      orderNumber,
      accessToken,
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}buyer@example.test`,
      phone: '600100200',
      firstName: 'Ala',
      lastName: 'Kowalska',
      street: 'Kwiatowa 5',
      postalCode: '30-001',
      city: 'Kraków',
      subtotalNetGrosze,
      vatGrosze,
      shippingGrosze: params.shippingGrosze,
      totalGrossGrosze,
      deliveryMethodNamePl: 'Kurier',
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'test',
      withdrawalAcknowledgedAt: new Date(),
      items: {
        create: params.lines.map((line) => ({
          quantity: 1,
          unitNetGrosze: line.net,
          unitGrossGrosze: line.net + line.vat,
          vatRateBp: 2_300,
          lineNetGrosze: line.net,
          lineVatGrosze: line.vat,
          lineGrossGrosze: line.net + line.vat,
          snapshot: { productNamePl: 'Testowy produkt' },
          snapshotVersion: 1,
          pricingVersion: 1,
          moduleCount: 1,
        })),
      },
    },
  });

  return { orderNumber, accessToken, total: totalGrossGrosze };
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
});

describe('findOrderForConfirmation - the numbers a customer is asked to pay from', () => {
  it('exposes the parts, and they sum to the total', async () => {
    const { orderNumber, accessToken } = await seedOrder({
      lines: [
        { net: 57_654, vat: 13_261 },
        { net: 12_000, vat: 2_760 },
      ],
      shippingGrosze: 5_200,
    });

    const view = await findOrderForConfirmation(orderNumber, accessToken);

    expect(view).not.toBeNull();
    // The assertion BUG-04 is about. Before this, `subtotalNetGrosze`,
    // `vatGrosze` and `shippingGrosze` were simply not on the view, so the
    // page could not have shown them however it was written.
    const itemsGross = (view?.items ?? []).reduce((sum, item) => sum + item.lineGrossGrosze, 0);
    expect(itemsGross + (view?.shippingGrosze ?? 0)).toBe(view?.totalGrossGrosze);
    expect((view?.subtotalNetGrosze ?? 0) + (view?.vatGrosze ?? 0)).toBe(itemsGross);
  });

  it('reports free delivery as a real zero, not as a missing line', async () => {
    // The case that reads as "nothing here" if the field is absent. A
    // customer who was given free delivery should be told so; silence looks
    // like an omission, and omissions on a payment document generate
    // support requests.
    const { orderNumber, accessToken } = await seedOrder({
      lines: [{ net: 10_000, vat: 2_300 }],
      shippingGrosze: 0,
    });

    const view = await findOrderForConfirmation(orderNumber, accessToken);

    expect(view?.shippingGrosze).toBe(0);
    expect(view?.totalGrossGrosze).toBe(12_300);
  });

  it('still refuses the wrong access token', async () => {
    // Widening the select must not widen who can read it.
    const { orderNumber } = await seedOrder({ lines: [{ net: 100, vat: 23 }], shippingGrosze: 0 });

    expect(await findOrderForConfirmation(orderNumber, uid())).toBeNull();
  });
});

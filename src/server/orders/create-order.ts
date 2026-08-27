/**
 * Order creation — `docs/ARCHITECTURE.md` §15.3's own numbered steps,
 * followed exactly: recompute every line from `Configuration` + current
 * `PricingSettings`, compare to the displayed total, build the snapshot,
 * insert `Order` + `OrderItem[]` + initial `OrderEvent`, clear the cart,
 * generate `orderNumber` and `accessToken`.
 *
 * Two phases, deliberately: everything that only READS (re-pricing every
 * cart item, comparing against the cached price) happens BEFORE any
 * transaction opens, so a stale-price rejection never holds a database
 * connection for longer than it has to. Only the writes — the per-month
 * order-number counter, `Order`/`OrderItem`/`OrderEvent`, clearing the
 * converted `CartItem` rows — run inside `prisma.$transaction`, all or
 * nothing together.
 */

import { randomBytes } from 'node:crypto';

import { sumGrosze } from '@/domain/money/money';
import { checkOrderStatusTransition } from '@/domain/order-status/transitions';
import type { OrderStatus } from '@/domain/order-status/transitions';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import type { PaymentMethod } from '@/generated/prisma/enums';
import { findCartForRequest } from '@/server/repositories/cart';
import type { CartItemView } from '@/server/repositories/cart';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import type { ValidatedPricing } from '@/server/configurator/validate-and-price';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { mailer } from '@/server/mail/mailer';
import { getStoreSettings } from '@/server/repositories/store-settings';
import { SITE } from '@/content/pl/site';
import type { OrderItemSnapshot } from './snapshot';

/** A real placeholder, same discipline as the withdrawal-exemption text — versioned so a later real Regulamin can supersede it traceably. */
const TERMS_VERSION = '1.0-draft';

export type CreateOrderInput = {
  readonly sessionToken: string | null;
  readonly userId: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string | null;
  readonly nip: string | null;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly paymentMethod: PaymentMethod;
};

export type CreateOrderResult =
  | { readonly ok: true; readonly orderNumber: string; readonly accessToken: string }
  | { readonly ok: false; readonly code: 'CART_EMPTY' }
  | { readonly ok: false; readonly code: 'PRICE_CHANGED' };

type RevalidatedItem = {
  readonly item: CartItemView;
  readonly validated: ValidatedPricing;
  readonly lineNetGrosze: number;
  readonly lineVatGrosze: number;
  readonly lineGrossGrosze: number;
};

function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const [cart, storeSettings] = await Promise.all([
    findCartForRequest({ userId: input.userId, sessionToken: input.sessionToken }),
    getStoreSettings(),
  ]);
  if (cart.items.length === 0) {
    return { ok: false, code: 'CART_EMPTY' };
  }

  const revalidated: RevalidatedItem[] = [];
  for (const item of cart.items) {
    const validated = await priceAndValidateSelections(item.productSlug, item.selections);
    // A mismatch here means the catalogue changed since this was added or
    // last edited (a price, a pricing version, or the configuration itself
    // stopped being feasible) — reject before ever touching the database,
    // per §15.3: "compare to the displayed total."
    if (
      validated === null ||
      validated.pricing.priceBreakdown.unitGrossGrosze !== item.priceGrossGrosze ||
      validated.pricing.priceBreakdown.pricingVersion !== item.pricingVersion
    ) {
      return { ok: false, code: 'PRICE_CHANGED' };
    }
    const { unitNetGrosze, unitGrossGrosze } = validated.pricing.priceBreakdown;
    const lineNetGrosze = unitNetGrosze * item.quantity;
    const lineGrossGrosze = unitGrossGrosze * item.quantity;
    revalidated.push({ item, validated, lineNetGrosze, lineGrossGrosze, lineVatGrosze: lineGrossGrosze - lineNetGrosze });
  }

  const subtotalNetGrosze = sumGrosze(revalidated.map((r) => r.lineNetGrosze));
  const vatGrosze = sumGrosze(revalidated.map((r) => r.lineVatGrosze));
  const shippingGrosze = storeSettings.shippingFlatRateGrosze;
  const totalGrossGrosze = subtotalNetGrosze + vatGrosze + shippingGrosze;

  const accessToken = randomBytes(32).toString('base64url');
  const cartItemIds = cart.items.map((i) => i.cartItemId);
  const now = new Date();
  const initialStatus: OrderStatus = input.paymentMethod === 'BANK_TRANSFER' ? 'AWAITING_PAYMENT' : 'NEW';

  const { orderNumber } = await prisma.$transaction(async (tx) => {
    const counterYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const counterRows = await tx.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "OrderNumberCounter" ("yearMonth", "lastValue")
      VALUES (${counterYearMonth}, 1)
      ON CONFLICT ("yearMonth")
      DO UPDATE SET "lastValue" = "OrderNumberCounter"."lastValue" + 1
      RETURNING "lastValue"
    `;
    const counterValue = counterRows[0]?.lastValue;
    if (counterValue === undefined) {
      throw new Error('createOrder: order-number counter upsert returned no row');
    }
    const number = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(counterValue).padStart(4, '0')}`;

    const order = await tx.order.create({
      data: {
        orderNumber: number,
        accessToken,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        userId: input.userId,
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        companyName: input.companyName,
        nip: input.nip,
        street: input.street,
        postalCode: input.postalCode,
        city: input.city,
        subtotalNetGrosze,
        vatGrosze,
        shippingGrosze,
        totalGrossGrosze,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: now,
        withdrawalExemptionTextPl: SITE.checkoutWithdrawalExemptionTextPl,
        withdrawalAcknowledgedAt: now,
        items: {
          create: revalidated.map((entry) => buildOrderItemInput(entry)),
        },
        events: {
          create: { fromStatus: null, toStatus: initialStatus, actorType: 'system' },
        },
      },
      select: { id: true },
    });

    // Automatic DESIGN_REVIEW entry — domain/order-status/transitions.ts's
    // own header: "happens automatically as soon as a custom design is
    // attached, no human decides to route an order there." Inert today (no
    // seeded product carries a CUSTOM_UPLOAD design, so customDesignId is
    // always null) but wired through the same tested state machine every
    // later staff-side transition will also use — not a bespoke check.
    const hasUnapprovedCustomDesign = revalidated.some(
      ({ item }) => item.customDesignId !== null && item.customDesignStatus !== 'APPROVED',
    );
    if (hasUnapprovedCustomDesign) {
      const transition = checkOrderStatusTransition({
        fromStatus: initialStatus,
        toStatus: 'DESIGN_REVIEW',
        actorType: 'system',
        hasUnapprovedCustomDesign: true,
      });
      if (transition.ok) {
        await tx.order.update({ where: { id: order.id }, data: { status: 'DESIGN_REVIEW' } });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            fromStatus: initialStatus,
            toStatus: 'DESIGN_REVIEW',
            actorType: 'system',
          },
        });
      }
    }

    // Exactly the items just priced and charged — not "whatever is in the
    // cart at commit time," which could include something added in a
    // second tab after this checkout started reading.
    await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds }, cartId: cart.cartId } });

    return { orderId: order.id, orderNumber: number };
  });

  // After commit, never inside the transaction — network I/O must not hold
  // a pooled DB connection open, and a mailer failure must never undo an
  // order that has already, correctly, been created (§15.3 note 3: "no fake
  // email delivery... the order still succeeds").
  void mailer
    .send('order-confirmation', input.email, {
      orderNumber,
      totalGrossGrosze,
      paymentMethod: input.paymentMethod as 'BANK_TRANSFER' | 'CONTACT_ARRANGED',
    })
    .catch(() => {
      // Logged inside the mailer itself; nothing else to do here.
    });

  void recordAnalyticsEvent({
    name: 'purchase',
    sessionToken: input.sessionToken,
    userId: input.userId,
    payload: { totalGrossGrosze },
  });

  return { ok: true, orderNumber, accessToken };
}

function buildOrderItemInput(entry: RevalidatedItem) {
  const { item, validated, lineNetGrosze, lineVatGrosze, lineGrossGrosze } = entry;
  const { priceBreakdown, moduleLayout } = validated.pricing;
  const selectedDesign =
    item.selections.designId === null ? null : (validated.data.designsById.get(item.selections.designId) ?? null);
  const productionMethod = selectedDesign?.recommendedMethod ?? null;

  const snapshot: OrderItemSnapshot = {
    productNamePl: item.productNamePl,
    designNamePl: item.designNamePl,
    designCode: item.designCode,
    materialNamePl: item.materialNamePl,
    finishNamePl: item.finishNamePl,
    fontNamePl: item.fontNamePl,
    widthMm: item.widthMm,
    heightMm: item.heightMm,
    thicknessMm: item.thicknessMm,
    installationVariant: item.selections.installationVariant,
    personalizationText: item.personalizationText,
    moduleLayout,
    priceBreakdown,
    machiningMilliMinutesPerM2: selectedDesign?.machiningMilliMinutesPerM2 ?? null,
  };

  return {
    quantity: item.quantity,
    unitNetGrosze: priceBreakdown.unitNetGrosze,
    unitGrossGrosze: priceBreakdown.unitGrossGrosze,
    vatRateBp: priceBreakdown.vatRateBp,
    lineNetGrosze,
    lineVatGrosze,
    lineGrossGrosze,
    snapshot: toJsonInput(snapshot),
    snapshotVersion: 1,
    pricingVersion: priceBreakdown.pricingVersion,
    customerDesignId: item.customDesignId,
    productionMethod,
    moduleCount: moduleLayout.totalModules,
  };
}

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
 * connection for longer than it has to. Only the writes — clearing the
 * converted `CartItem` rows, the per-month order-number counter,
 * `Order`/`OrderItem`/`OrderEvent` — run inside `prisma.$transaction`, all
 * or nothing together.
 *
 * 2026-08-30 (`docs/AUDIT-2026-08-30.md` P0-2): this used to have no
 * idempotency mechanism at all, so two submissions of one checkout — two
 * tabs, a retried request, a back-and-resubmit — each created a real order
 * for one purchase. Two independent guards now make that impossible, and
 * they cover different cases on purpose:
 *
 *   1. `idempotencyKey` (`@unique` on `Order`) dedupes repeat submissions of
 *      the SAME rendered form. The repeat gets the first attempt's real
 *      order back, so a customer who double-clicked still lands on their
 *      confirmation page rather than an error.
 *   2. Claiming the cart rows as the transaction's FIRST write dedupes two
 *      DIFFERENT renders racing (two tabs, each with its own key), which no
 *      key could catch. The loser rolls back and is told so honestly.
 */

import { randomBytes } from 'node:crypto';

import { sumGrosze } from '@/domain/money/money';
import { checkOrderStatusTransition } from '@/domain/order-status/transitions';
import type { OrderStatus } from '@/domain/order-status/transitions';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { findCartForRequest } from '@/server/repositories/cart';
import type { CartItemView } from '@/server/repositories/cart';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import type { ValidatedPricing } from '@/server/configurator/validate-and-price';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { mailer } from '@/server/mail/mailer';
import { resolveDeliveryMethodsForCart } from '@/server/repositories/delivery-methods';
import { findPickupPointById } from '@/server/delivery/pickup-points';
import { SITE } from '@/content/pl/site';
import type { OrderItemSnapshot } from './snapshot';

/** A real placeholder, same discipline as the withdrawal-exemption text — versioned so a later real Regulamin can supersede it traceably. */
const TERMS_VERSION = '1.0-draft';

export type CreateOrderInput = {
  /**
   * One checkout render's own submission id (`docs/AUDIT-2026-08-30.md`
   * P0-2). Minted server-side per page load, carried in a hidden field, so
   * every resubmission of the SAME rendered form — a double click, a retry
   * after a dropped connection, a back-and-resubmit — arrives carrying this
   * same value and gets the first order back instead of a second one.
   */
  readonly idempotencyKey: string;
  readonly sessionToken: string | null;
  readonly userId: string | null;
  readonly email: string;
  /** Required, per owner request — never `null` (§ schema comment on `Order.phone`). */
  readonly phone: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string | null;
  readonly nip: string | null;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly paymentMethodConfigId: string;
  readonly deliveryMethodId: string;
  /** Required (and re-validated against `server/delivery/pickup-points.ts`) only when the chosen `DeliveryMethod.requiresPickupPoint` is true — `null` otherwise. */
  readonly pickupPointId: string | null;
  /** Instructions FOR the courier (gate code, floor, "leave with neighbour") — shown on shipping labels/handed to the courier, never to internal staff-only views. */
  readonly courierNotePl: string | null;
  /** A note FOR US about the shipment — nothing to do with production, staff-visible only. */
  readonly internalShipmentNotePl: string | null;
};

export type CreateOrderResult =
  | { readonly ok: true; readonly orderNumber: string; readonly accessToken: string }
  | { readonly ok: false; readonly code: 'CART_EMPTY' }
  /** Another checkout — a second tab, a second device — consumed this cart while this one was being submitted. Nothing was charged twice; the customer is told to check their orders. */
  | { readonly ok: false; readonly code: 'CART_CHANGED' }
  | { readonly ok: false; readonly code: 'PRICE_CHANGED' }
  | { readonly ok: false; readonly code: 'DELIVERY_METHOD_INVALID' }
  | { readonly ok: false; readonly code: 'PAYMENT_METHOD_INVALID' }
  | { readonly ok: false; readonly code: 'PICKUP_POINT_INVALID' };

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

/**
 * Thrown inside the transaction when the cart rows this checkout priced are
 * no longer there to claim — another checkout of the same cart committed
 * first. Prisma rolls the whole transaction back on any throw, so nothing
 * partial survives; the caller turns this into a real result code.
 */
class CartAlreadyClaimedError extends Error {}

/** Prisma's unique-constraint code, duck-typed rather than instance-checked so this never depends on which generated client instance threw it. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** The order this exact submission already produced, if it has run before. */
async function findOrderByIdempotencyKey(
  idempotencyKey: string,
): Promise<{ readonly orderNumber: string; readonly accessToken: string } | null> {
  return prisma.order.findUnique({
    where: { idempotencyKey },
    select: { orderNumber: true, accessToken: true },
  });
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  // Fast path for the overwhelmingly common repeat: this submission already
  // succeeded once. Answer with the order it produced — the customer who
  // double-clicked still belongs on their real confirmation page, not on an
  // error. The `@unique` index is the actual guarantee (this read alone
  // would race); this just avoids doing all the pricing work again.
  const alreadyPlaced = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (alreadyPlaced !== null) {
    return { ok: true, ...alreadyPlaced };
  }

  const cart = await findCartForRequest({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });
  if (cart.items.length === 0) {
    return { ok: false, code: 'CART_EMPTY' };
  }

  // `resolveDeliveryMethodsForCart` re-runs the EXACT same real weight/
  // locker-fit/free-threshold evaluation the checkout page used to render
  // the picker — never trusts a price the client last rendered, and never
  // trusts that a method still exists, is still active, or is still
  // feasible for this cart between page load and submission.
  const [deliveryMethods, paymentMethodConfig] = await Promise.all([
    resolveDeliveryMethodsForCart(cart),
    prisma.paymentMethodConfig.findFirst({
      where: { id: input.paymentMethodConfigId, isActive: true, isConnected: true },
      select: { provider: true },
    }),
  ]);
  const deliveryMethod =
    deliveryMethods.find((method) => method.id === input.deliveryMethodId) ?? null;
  if (deliveryMethod === null || !deliveryMethod.feasible) {
    return { ok: false, code: 'DELIVERY_METHOD_INVALID' };
  }
  // `isConnected: false` (an unconnected provider like Przelewy24) is
  // rejected the same as a non-existent id — never just "disabled and
  // explained," since there's no real payment flow behind it to send
  // anyone into (§15's "no fake payment" rule).
  if (paymentMethodConfig === null) {
    return { ok: false, code: 'PAYMENT_METHOD_INVALID' };
  }
  // A method that requires a pickup point (`requiresPickupPoint`) never
  // trusts the id/label the client last rendered — the id is re-looked-up
  // in the same static dataset the picker searched, same "never trust the
  // client" discipline as the delivery/payment method checks just above.
  const pickupPoint =
    deliveryMethod.requiresPickupPoint &&
    deliveryMethod.carrier !== null &&
    input.pickupPointId !== null
      ? findPickupPointById(deliveryMethod.carrier, input.pickupPointId)
      : null;
  if (deliveryMethod.requiresPickupPoint && pickupPoint === null) {
    return { ok: false, code: 'PICKUP_POINT_INVALID' };
  }

  // Re-priced in parallel, not one-after-another (`docs/AUDIT-2026-08-30.md`
  // P1-7): each item's re-pricing does its own catalogue reads and none of
  // them depends on another's result, so a sequential `for … await` made a
  // customer with five items wait through five round-trip waterfalls on the
  // submit button. `Promise.all` preserves order, so the mismatch check
  // below still reports on the items in the order they appear in the cart.
  const priced = await Promise.all(
    cart.items.map(async (item) => ({
      item,
      validated: await priceAndValidateSelections(item.productSlug, item.selections),
    })),
  );

  const revalidated: RevalidatedItem[] = [];
  for (const { item, validated } of priced) {
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
    revalidated.push({
      item,
      validated,
      lineNetGrosze,
      lineGrossGrosze,
      lineVatGrosze: lineGrossGrosze - lineNetGrosze,
    });
  }

  const subtotalNetGrosze = sumGrosze(revalidated.map((r) => r.lineNetGrosze));
  const vatGrosze = sumGrosze(revalidated.map((r) => r.lineVatGrosze));
  // `deliveryMethod.priceGrosze` here is already the real, fully evaluated
  // price for THIS cart (weight tier / free-shipping threshold / flat-rate
  // fallback — `resolveDeliveryMethodsForCart` above) — every per-item
  // price in `revalidated` was just confirmed to match `cart`'s own cached
  // figures, so re-deriving it again from the post-revalidation total would
  // only ever agree, never differ.
  const shippingGrosze = deliveryMethod.priceGrosze;
  const totalGrossGrosze = subtotalNetGrosze + vatGrosze + shippingGrosze;

  const accessToken = randomBytes(32).toString('base64url');
  const cartItemIds = cart.items.map((i) => i.cartItemId);
  const now = new Date();
  const initialStatus: OrderStatus =
    paymentMethodConfig.provider === 'BANK_TRANSFER' ? 'AWAITING_PAYMENT' : 'NEW';

  const placeOrder = () =>
    prisma.$transaction(async (tx) => {
      // CLAIMED FIRST, before anything is written (`docs/AUDIT-2026-08-30.md`
      // P0-2). These are exactly the rows just priced and about to be charged
      // — not "whatever is in the cart at commit time," which could include
      // something added in a second tab after this checkout started reading.
      //
      // Deleting them up front also makes this the concurrency choke point: a
      // second checkout of the same cart blocks here on these row locks until
      // this transaction commits, then finds nothing left to delete. Coming up
      // short means someone else already bought this cart, so this whole
      // transaction rolls back rather than creating a second order for it.
      const claimed = await tx.cartItem.deleteMany({
        where: { id: { in: cartItemIds }, cartId: cart.cartId },
      });
      if (claimed.count !== cartItemIds.length) {
        throw new CartAlreadyClaimedError();
      }

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
          idempotencyKey: input.idempotencyKey,
          status: initialStatus,
          paymentMethod: paymentMethodConfig.provider,
          paymentMethodConfigId: input.paymentMethodConfigId,
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
          deliveryMethodId: input.deliveryMethodId,
          deliveryMethodNamePl: deliveryMethod.namePl,
          pickupPointId: pickupPoint?.id ?? null,
          pickupPointLabel: pickupPoint?.label ?? null,
          courierNotePl: input.courierNotePl,
          internalShipmentNotePl: input.internalShipmentNotePl,
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
        ({ item }) =>
          item.customDesignId !== null && item.customDesignStatus !== 'APPROVED',
      );
      if (hasUnapprovedCustomDesign) {
        const transition = checkOrderStatusTransition({
          fromStatus: initialStatus,
          toStatus: 'DESIGN_REVIEW',
          actorType: 'system',
          hasUnapprovedCustomDesign: true,
        });
        if (transition.ok) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'DESIGN_REVIEW' },
          });
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

      return { orderId: order.id, orderNumber: number };
    });

  let orderNumber: string;
  try {
    ({ orderNumber } = await placeOrder());
  } catch (error) {
    // Both failure shapes below mean the same thing to the customer —
    // "someone already checked this cart out" — but only one of them means
    // it was THEM, submitting the same form twice. Re-reading the key
    // distinguishes the two: a hit is this submission's own winning attempt
    // (the other request got there first), so the caller lands on their real
    // order; a miss is a genuinely different checkout, which is a real
    // rejection.
    if (error instanceof CartAlreadyClaimedError || isUniqueConstraintViolation(error)) {
      const winner = await findOrderByIdempotencyKey(input.idempotencyKey);
      if (winner !== null) {
        return { ok: true, ...winner };
      }
      if (error instanceof CartAlreadyClaimedError) {
        return { ok: false, code: 'CART_CHANGED' };
      }
    }
    throw error;
  }

  // Cache invalidation deliberately does NOT live here — it moved up to
  // `actions/checkout.ts`, which is the layer that actually runs inside a
  // request. `revalidatePath` throws "static generation store missing"
  // anywhere else, which made this whole function untestable the moment a
  // test got far enough to succeed (`docs/AUDIT-2026-08-30.md` P0-2's own
  // tests hit exactly that). Same split the `apply*`/wrapper pairs already
  // use: real logic here, framework side effects in the action.

  // After commit, never inside the transaction — network I/O must not hold
  // a pooled DB connection open, and a mailer failure must never undo an
  // order that has already, correctly, been created (§15.3 note 3: "no fake
  // email delivery... the order still succeeds").
  void mailer
    .send('order-confirmation', input.email, {
      orderNumber,
      totalGrossGrosze,
      // Safe today: only BANK_TRANSFER/CONTACT_ARRANGED are ever seeded
      // `isConnected: true`, so `paymentMethodConfig` (checked above) can
      // never resolve to anything else in practice. Revisit this cast the
      // day a real third provider actually goes connected — the mailer
      // template itself would need a real Przelewy24/card/PayPal copy
      // block first, which is out of this phase's scope.
      paymentMethod: paymentMethodConfig.provider as 'BANK_TRANSFER' | 'CONTACT_ARRANGED',
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
    item.selections.designId === null
      ? null
      : (validated.data.designsById.get(item.selections.designId) ?? null);
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

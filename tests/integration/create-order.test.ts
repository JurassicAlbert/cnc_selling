import { afterEach, describe, expect, it } from 'vitest';

import { createOrder } from '@/server/orders/create-order';
import { prisma } from '@/server/db/client';

/**
 * P9 phases 5 & 6: `createOrder` re-checks both the chosen `DeliveryMethod`
 * and the chosen `PaymentMethodConfig` itself, never trusting whatever the
 * checkout form last rendered — the same "never trust client-side prices"
 * discipline as its own per-item re-pricing loop. Both checks run BEFORE
 * that pricing loop (right after the cart-emptiness check, in that order:
 * cart → delivery → payment), so they're reachable with a minimal, real
 * but not-necessarily-priceable cart item — same bare-bones
 * `Configuration`/`CartItem` shape `auth.test.ts`'s cart-merge tests
 * already use. The "creates a real order with correctly computed
 * shipping/payment" success path needs a genuinely priceable
 * product/config (materials, thicknesses, dimension envelope, pricing
 * version) — that's exercised end-to-end instead by the existing real e2e
 * checkout spec (`tests/e2e/checkout.spec.ts`) plus this session's own
 * live browser/DB verification, not duplicated here.
 */

const PREFIX = 'test-create-order-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedBareProduct() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
  });
  return prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: `${PREFIX}produkt`,
      shortDescPl: 'Test',
      longDescPl: 'Test',
      careInstructionsPl: 'Test',
      seoTitlePl: 'Test',
      seoDescPl: 'Test',
      basePriceGrosze: 10_000,
      minPriceGrosze: 10_000,
      productionDaysMin: 1,
      productionDaysMax: 2,
      minWidthMm: 100,
      maxWidthMm: 1000,
      minHeightMm: 100,
      maxHeightMm: 1000,
    },
  });
}

async function seedGuestCartWithOneItem() {
  const sessionToken = uid();
  const product = await seedBareProduct();
  const configuration = await prisma.configuration.create({
    data: { sessionToken, productId: product.id, isComplete: true },
  });
  const cart = await prisma.cart.create({ data: { sessionToken } });
  await prisma.cartItem.create({ data: { cartId: cart.id, configurationId: configuration.id, quantity: 1 } });
  return { sessionToken, product, cart };
}

async function seedDeliveryMethod(overrides: { readonly isActive?: boolean; readonly requiresPickupPoint?: boolean } = {}) {
  return prisma.deliveryMethod.create({
    data: {
      namePl: `${PREFIX}dostawa`,
      descPl: 'Test',
      priceGrosze: 1_500,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      isActive: overrides.isActive ?? true,
      requiresPickupPoint: overrides.requiresPickupPoint ?? false,
    },
  });
}

async function seedPaymentMethodConfig(overrides: { readonly isActive?: boolean; readonly isConnected?: boolean } = {}) {
  return prisma.paymentMethodConfig.create({
    data: {
      namePl: `${PREFIX}platnosc`,
      descPl: 'Test',
      provider: 'BANK_TRANSFER',
      isActive: overrides.isActive ?? true,
      isConnected: overrides.isConnected ?? true,
    },
  });
}

function baseInput(overrides: {
  readonly sessionToken: string;
  readonly deliveryMethodId: string;
  readonly paymentMethodConfigId: string;
  readonly pickupPointId?: string | null;
}) {
  return {
    sessionToken: overrides.sessionToken,
    userId: null,
    email: 'test@example.test',
    phone: null,
    firstName: 'Test',
    lastName: 'Testowy',
    companyName: null,
    nip: null,
    street: 'Testowa 1',
    postalCode: '00-001',
    city: 'Warszawa',
    deliveryMethodId: overrides.deliveryMethodId,
    paymentMethodConfigId: overrides.paymentMethodConfigId,
    pickupPointId: overrides.pickupPointId ?? null,
  };
}

afterEach(async () => {
  await prisma.order.deleteMany({
    where: { OR: [{ deliveryMethod: { namePl: { startsWith: PREFIX } } }, { paymentMethodConfig: { namePl: { startsWith: PREFIX } } }] },
  });
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.paymentMethodConfig.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('createOrder — delivery method validation', () => {
  it('rejects a delivery method id that does not exist', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: 'does-not-exist', paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('rejects a real but deactivated delivery method — never trusts what the form last rendered', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const method = await seedDeliveryMethod({ isActive: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: method.id, paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('still rejects with CART_EMPTY for an empty cart even when the delivery method id is bogus — cart-emptiness is checked first', async () => {
    const sessionToken = uid();
    await prisma.cart.create({ data: { sessionToken } });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: 'does-not-exist', paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'CART_EMPTY' });

    await prisma.cart.deleteMany({ where: { sessionToken } });
  });
});

describe('createOrder — payment method validation', () => {
  it('rejects a payment method config id that does not exist', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });

  it('rejects a real but deactivated payment method', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig({ isActive: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });

  it('rejects a real, active, but unconnected payment method — never treated as "disabled but selectable", always fully unreachable', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig({ isConnected: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });
});

/**
 * 2026-08-29, owner request: real pickup-point ("paczkomat/punkt odbioru")
 * validation for a `DeliveryMethod` with `requiresPickupPoint: true` — the
 * id is re-checked against `server/delivery/pickup-points.ts`'s own static
 * dataset, never trusted from whatever the checkout form last rendered,
 * same layering as the delivery/payment method checks above.
 */
describe('createOrder — pickup point validation', () => {
  it('rejects a required pickup point that was never chosen', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: true });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: null }));

    expect(result).toEqual({ ok: false, code: 'PICKUP_POINT_INVALID' });
  });

  it('rejects a pickup point id that does not exist in the dataset — never trusts an id echoed back by the client', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: true });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(
      baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: 'not-a-real-point' }),
    );

    expect(result).toEqual({ ok: false, code: 'PICKUP_POINT_INVALID' });
  });

  it('a pickup point id is ignored (never required) for a method that does not require one', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: false });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: null }));

    // Both the delivery and payment checks pass; the next real rejection is
    // the per-item re-pricing loop, since the bare-bones seeded product has
    // no pricing rules — proof this path is reached at all, not stuck on
    // pickup-point validation for a method that never asked for one.
    expect(result).toEqual({ ok: false, code: 'PRICE_CHANGED' });
  });
});

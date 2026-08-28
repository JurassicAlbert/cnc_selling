import { afterEach, describe, expect, it } from 'vitest';

import { createOrder } from '@/server/orders/create-order';
import { prisma } from '@/server/db/client';

/**
 * P9 phase 5: `createOrder` re-checks the chosen `DeliveryMethod` itself,
 * never trusting whatever the checkout form last rendered — the same
 * "never trust client-side prices" discipline as its own per-item
 * re-pricing loop. This check runs BEFORE that pricing loop (right after
 * the cart-emptiness check), so it's reachable with a minimal, real but
 * not-necessarily-priceable cart item — same bare-bones
 * `Configuration`/`CartItem` shape `auth.test.ts`'s cart-merge tests
 * already use. The "creates a real order with correctly computed
 * shipping" success path needs a genuinely priceable product/config
 * (materials, thicknesses, dimension envelope, pricing version) — that's
 * exercised end-to-end instead by the existing real e2e checkout spec
 * (`tests/e2e/checkout.spec.ts`) plus this session's own live browser
 * verification, not duplicated here.
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

async function seedDeliveryMethod(overrides: { readonly isActive?: boolean } = {}) {
  return prisma.deliveryMethod.create({
    data: {
      namePl: `${PREFIX}metoda`,
      descPl: 'Test',
      priceGrosze: 1_500,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      isActive: overrides.isActive ?? true,
    },
  });
}

afterEach(async () => {
  await prisma.order.deleteMany({ where: { deliveryMethod: { namePl: { startsWith: PREFIX } } } });
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('createOrder — delivery method validation', () => {
  it('rejects a delivery method id that does not exist', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();

    const result = await createOrder({
      sessionToken,
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
      paymentMethod: 'BANK_TRANSFER',
      deliveryMethodId: 'does-not-exist',
    });

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('rejects a real but deactivated delivery method — never trusts what the form last rendered', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const method = await seedDeliveryMethod({ isActive: false });

    const result = await createOrder({
      sessionToken,
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
      paymentMethod: 'BANK_TRANSFER',
      deliveryMethodId: method.id,
    });

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('still rejects with CART_EMPTY for an empty cart even when the delivery method id is bogus — cart-emptiness is checked first', async () => {
    const sessionToken = uid();
    await prisma.cart.create({ data: { sessionToken } });

    const result = await createOrder({
      sessionToken,
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
      paymentMethod: 'BANK_TRANSFER',
      deliveryMethodId: 'does-not-exist',
    });

    expect(result).toEqual({ ok: false, code: 'CART_EMPTY' });

    await prisma.cart.deleteMany({ where: { sessionToken } });
  });
});

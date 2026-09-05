import { afterEach, describe, expect, it } from 'vitest';

import { MAX_CART_ITEM_QUANTITY } from '@/domain/cart/quantity';
import { mergeGuestCartIntoUser } from '@/server/cart/merge-guest-cart';
import { findOrderForUser, listOrdersForUser } from '@/server/repositories/orders';
import { listConfigurationsForUser } from '@/server/repositories/cart';
import { prisma } from '@/server/db/client';

/**
 * P6 Part B (guest-cart-merge-on-login) and Part C (order history / saved
 * configurations, `userId`-scoped). Same "real database, explicit cleanup"
 * discipline as `authz.test.ts` - every row's `email`/`sessionToken`
 * prefixed `test-p6-`, `afterEach` deletes everything under that prefix.
 * Not `withTestTransaction`: `mergeGuestCartIntoUser` opens its own
 * `$transaction` on the app's singleton, so a write made inside an outer,
 * still-open `withTestTransaction` would be invisible to it (the same
 * cross-connection visibility gap `authz.test.ts`'s header documents).
 */

const PREFIX = 'test-p6-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

afterEach(async () => {
  await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { startsWith: PREFIX } } } } });
  await prisma.cart.deleteMany({ where: { OR: [{ sessionToken: { startsWith: PREFIX } }, { user: { email: { startsWith: PREFIX } } }] } });
  await prisma.configuration.deleteMany({ where: { OR: [{ sessionToken: { startsWith: PREFIX } }, { user: { email: { startsWith: PREFIX } } }] } });
  await prisma.orderItem.deleteMany({ where: { order: { user: { email: { startsWith: PREFIX } } } } });
  await prisma.order.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

async function seedUser() {
  return prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test User', role: 'CUSTOMER' } });
}

async function seedProduct() {
  const category = await prisma.category.create({
    data: {
      slug: uid(),
      namePl: 'Test Category',
      descPl: 'Test',
      seoTitlePl: 'Test',
      seoDescPl: 'Test',
    },
  });
  return prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: 'Test Product',
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

describe('mergeGuestCartIntoUser (P6 Part B)', () => {
  it('no-op when there is no guest session token', async () => {
    const user = await seedUser();
    await expect(mergeGuestCartIntoUser(user.id, null)).resolves.toBeUndefined();
  });

  it('no-op when the guest session has no cart', async () => {
    const user = await seedUser();
    await expect(mergeGuestCartIntoUser(user.id, uid())).resolves.toBeUndefined();
  });

  it('reassigns the guest cart to the user when the user has no cart yet', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const guestToken = uid();

    const configuration = await prisma.configuration.create({
      data: { sessionToken: guestToken, productId: product.id, isComplete: true },
    });
    const guestCart = await prisma.cart.create({ data: { sessionToken: guestToken } });
    await prisma.cartItem.create({ data: { cartId: guestCart.id, configurationId: configuration.id, configurationSignature: configuration.id, quantity: 1 } });

    await mergeGuestCartIntoUser(user.id, guestToken);

    const mergedCart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(mergedCart?.id).toBe(guestCart.id);
    expect(mergedCart?.sessionToken).toBeNull();
    expect(mergedCart?.items).toHaveLength(1);
  });

  it('moves items onto the existing user cart and deletes the guest cart when the user already has one', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const guestToken = uid();

    const userConfiguration = await prisma.configuration.create({
      data: { userId: user.id, productId: product.id, isComplete: true },
    });
    const userCart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.cartItem.create({ data: { cartId: userCart.id, configurationId: userConfiguration.id, configurationSignature: userConfiguration.id, quantity: 1 } });

    const guestConfiguration = await prisma.configuration.create({
      data: { sessionToken: guestToken, productId: product.id, isComplete: true },
    });
    const guestCart = await prisma.cart.create({ data: { sessionToken: guestToken } });
    await prisma.cartItem.create({ data: { cartId: guestCart.id, configurationId: guestConfiguration.id, configurationSignature: guestConfiguration.id, quantity: 1 } });

    await mergeGuestCartIntoUser(user.id, guestToken);

    const mergedCart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(mergedCart?.id).toBe(userCart.id);
    expect(mergedCart?.items).toHaveLength(2);

    const deletedGuestCart = await prisma.cart.findUnique({ where: { id: guestCart.id } });
    expect(deletedGuestCart).toBeNull();
  });
});

describe('order history / saved configurations ownership (P6 Part C)', () => {
  it('listOrdersForUser only returns the given user\'s own orders', async () => {
    const owner = await seedUser();
    const stranger = await seedUser();

    await prisma.order.create({
      data: {
        orderNumber: uid(),
        userId: owner.id,
        accessToken: uid(),
        paymentMethod: 'BANK_TRANSFER',
        email: owner.email,
        phone: '+48123456789',
        firstName: 'Test',
        lastName: 'Test',
        street: 'Test 1',
        postalCode: '00-001',
        city: 'Test',
        subtotalNetGrosze: 100,
        vatGrosze: 23,
        shippingGrosze: 0,
        deliveryMethodNamePl: 'Test',
        totalGrossGrosze: 123,
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'Test',
        withdrawalAcknowledgedAt: new Date(),
      },
    });

    const ownerOrders = await listOrdersForUser(owner.id);
    const strangerOrders = await listOrdersForUser(stranger.id);
    expect(ownerOrders).toHaveLength(1);
    expect(strangerOrders).toHaveLength(0);
  });

  it('findOrderForUser returns null for another user\'s order - the 404-not-403 case', async () => {
    const owner = await seedUser();
    const stranger = await seedUser();
    const orderNumber = uid();

    await prisma.order.create({
      data: {
        orderNumber,
        userId: owner.id,
        accessToken: uid(),
        paymentMethod: 'BANK_TRANSFER',
        email: owner.email,
        phone: '+48123456789',
        firstName: 'Test',
        lastName: 'Test',
        street: 'Test 1',
        postalCode: '00-001',
        city: 'Test',
        subtotalNetGrosze: 100,
        vatGrosze: 23,
        shippingGrosze: 0,
        deliveryMethodNamePl: 'Test',
        totalGrossGrosze: 123,
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'Test',
        withdrawalAcknowledgedAt: new Date(),
      },
    });

    expect(await findOrderForUser(orderNumber, owner.id)).not.toBeNull();
    expect(await findOrderForUser(orderNumber, stranger.id)).toBeNull();
  });

  it('listConfigurationsForUser only returns the given user\'s own configurations', async () => {
    const owner = await seedUser();
    const stranger = await seedUser();
    const product = await seedProduct();

    await prisma.configuration.create({ data: { userId: owner.id, productId: product.id, isComplete: true } });

    expect(await listConfigurationsForUser(owner.id)).toHaveLength(1);
    expect(await listConfigurationsForUser(stranger.id)).toHaveLength(0);
  });
});

/**
 * 2026-08-30 duplicate sweep. The merge moved every guest `CartItem` onto
 * the user's cart with a single `updateMany`, which was fine while two
 * identical lines were merely untidy. Once
 * `@@unique([cartId, configurationSignature])` existed to stop identical
 * lines, that same statement started VIOLATING it: a customer who had the
 * same product in their logged-out cart and in their account cart hit a
 * unique-constraint error inside the login transaction.
 *
 * So this is two bugs in one place - the duplicate the owner asked about,
 * and a login that fails outright for the exact customer who has it.
 */
describe('mergeGuestCartIntoUser - the same product in both carts', () => {
  it('merges the two lines into one and adds their quantities, instead of failing the login', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const guestToken = uid();
    // The same configuration identity on both sides - what a customer who
    // added the same thing logged-out and logged-in actually has.
    const sharedSignature = uid();

    const userConfiguration = await prisma.configuration.create({
      data: { userId: user.id, productId: product.id, isComplete: true },
    });
    const userCart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.cartItem.create({
      data: { cartId: userCart.id, configurationId: userConfiguration.id, configurationSignature: sharedSignature, quantity: 2 },
    });

    const guestConfiguration = await prisma.configuration.create({
      data: { sessionToken: guestToken, productId: product.id, isComplete: true },
    });
    const guestCart = await prisma.cart.create({ data: { sessionToken: guestToken } });
    await prisma.cartItem.create({
      data: { cartId: guestCart.id, configurationId: guestConfiguration.id, configurationSignature: sharedSignature, quantity: 3 },
    });

    await expect(mergeGuestCartIntoUser(user.id, guestToken)).resolves.toBeUndefined();

    const mergedCart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(mergedCart?.id).toBe(userCart.id);
    expect(mergedCart?.items).toHaveLength(1);
    // Nothing the customer chose is lost: 2 + 3.
    expect(mergedCart?.items[0]?.quantity).toBe(5);
    expect(await prisma.cart.findUnique({ where: { id: guestCart.id } })).toBeNull();
  });

  it('never merges past the per-line maximum quantity', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const guestToken = uid();
    const sharedSignature = uid();

    const userConfiguration = await prisma.configuration.create({
      data: { userId: user.id, productId: product.id, isComplete: true },
    });
    const userCart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.cartItem.create({
      data: { cartId: userCart.id, configurationId: userConfiguration.id, configurationSignature: sharedSignature, quantity: 20 },
    });

    const guestConfiguration = await prisma.configuration.create({
      data: { sessionToken: guestToken, productId: product.id, isComplete: true },
    });
    const guestCart = await prisma.cart.create({ data: { sessionToken: guestToken } });
    await prisma.cartItem.create({
      data: { cartId: guestCart.id, configurationId: guestConfiguration.id, configurationSignature: sharedSignature, quantity: 20 },
    });

    await mergeGuestCartIntoUser(user.id, guestToken);

    const mergedCart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(mergedCart?.items[0]?.quantity).toBe(MAX_CART_ITEM_QUANTITY);
  });
});

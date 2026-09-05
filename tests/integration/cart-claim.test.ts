/**
 * `docs/AI-CHECKLIST.md` BUG-13 - a quantity changed in another tab was
 * charged at the old value.
 *
 * `createOrder` prices the cart, then claims those rows inside its
 * transaction by deleting them. The claim used to be `id IN (...)` alone,
 * which asks "are these lines still here" and not "are they still what I
 * charged for". So a quantity changed between the pricing read and the
 * transaction was claimed happily: the customer paid for two of something
 * they had just reduced to one, or got one of something they had just made
 * three, and the order snapshot recorded the stale figure as fact.
 *
 * **Why the predicate is tested and not the race.** Making the change land in
 * the window between the read and the claim means winning a timing race on
 * purpose, and a test that has to win a race is a test that intermittently
 * loses one - this repository has three separate records of exactly that. The
 * predicate is the part that regresses (someone "simplifying" the `OR` back to
 * an `IN`), so the predicate is what is pinned, and it is pinned against real
 * Postgres rather than by inspecting the object: what matters is how the
 * database answers it.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { cartClaimWhere } from '@/server/orders/create-order';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-bug13-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

afterEach(async () => {
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

/** A minimal but real product - `Configuration` requires one. */
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

/** Two lines, quantities 1 and 2 - enough for "one moved, one did not". */
async function seedCart() {
  const sessionToken = uid();
  const product = await seedBareProduct();
  const cart = await prisma.cart.create({ data: { sessionToken } });

  const items = await Promise.all(
    [1, 2].map(async (quantity) => {
      const configuration = await prisma.configuration.create({
        data: { sessionToken, productId: product.id, isComplete: true },
      });
      return prisma.cartItem.create({
        data: {
          cartId: cart.id,
          configurationId: configuration.id,
          configurationSignature: configuration.id,
          quantity,
        },
      });
    }),
  );

  return {
    cartId: cart.id,
    priced: items.map((item) => ({ cartItemId: item.id, quantity: item.quantity })),
  };
}

describe('cartClaimWhere', () => {
  it('claims every line that is still exactly what was priced', async () => {
    const { cartId, priced } = await seedCart();

    const claimed = await prisma.cartItem.deleteMany({ where: cartClaimWhere(cartId, priced) });

    expect(claimed.count).toBe(priced.length);
  });

  it('comes up short when a quantity moved after pricing - the whole point', async () => {
    const { cartId, priced } = await seedCart();

    // The second tab: the customer changed their mind about one line.
    const moved = priced[0];
    if (moved === undefined) {
      throw new Error('seedCart must produce at least one line');
    }
    await prisma.cartItem.update({ where: { id: moved.cartItemId }, data: { quantity: 7 } });

    const claimed = await prisma.cartItem.deleteMany({ where: cartClaimWhere(cartId, priced) });

    // Short by exactly the changed line. `createOrder` compares this count
    // against the number of lines it priced and rolls the whole transaction
    // back, which surfaces as CART_CHANGED.
    expect(claimed.count).toBe(priced.length - 1);
  });

  it('leaves the changed row in the cart rather than deleting it half-claimed', async () => {
    // If the short claim were allowed to stand, the customer would lose the
    // line they had just edited. It survives, and the rollback in `createOrder`
    // restores the others.
    const { cartId, priced } = await seedCart();
    const moved = priced[0];
    if (moved === undefined) {
      throw new Error('seedCart must produce at least one line');
    }
    await prisma.cartItem.update({ where: { id: moved.cartItemId }, data: { quantity: 7 } });

    await prisma.cartItem.deleteMany({ where: cartClaimWhere(cartId, priced) });

    expect(await prisma.cartItem.findUnique({ where: { id: moved.cartItemId } })).not.toBeNull();
  });

  it('still refuses a line that belongs to another cart', async () => {
    // The `cartId` half of the predicate, which BUG-13 must not weaken: the
    // rows are addressed by id, and an id alone is not proof of ownership.
    const mine = await seedCart();
    const theirs = await seedCart();

    const claimed = await prisma.cartItem.deleteMany({
      where: cartClaimWhere(mine.cartId, theirs.priced),
    });

    expect(claimed.count).toBe(0);
  });

  it('claims nothing for an empty cart rather than everything', async () => {
    // An `OR: []` is falsy in Prisma, not "match all". Worth pinning: the
    // opposite would delete every row in the cart.
    const { cartId } = await seedCart();

    const claimed = await prisma.cartItem.deleteMany({ where: cartClaimWhere(cartId, []) });

    expect(claimed.count).toBe(0);
    expect(await prisma.cartItem.count({ where: { cartId } })).toBe(2);
  });
});

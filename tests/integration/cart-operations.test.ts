import { afterEach, describe, expect, it } from 'vitest';

import { MAX_CART_ITEM_QUANTITY } from '@/domain/cart/quantity';
import type { Selections } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { findCartForRequest } from '@/server/repositories/cart';
import {
  applyAddToCart,
  applyAdjustCartItemQuantity,
  applyDuplicateCartItem,
  applyRemoveCartItem,
} from '@/server/operations/cart';
import type { Owner } from '@/server/session/ownership';

/**
 * The realistic-user-behaviour half of `docs/AUDIT-2026-08-30.md`: the
 * things a real person does that a developer clicking carefully once never
 * sees. Double-clicking. Clicking `+` twice before the page catches up.
 * Two tabs.
 *
 * These run against the real cart operations rather than the Server Actions
 * that wrap them — the wrappers call `cookies()`, which throws outside a
 * request scope, and separating the two is exactly what made this testable
 * (see `src/server/operations/cart.ts`'s header). The ownership rules the
 * wrappers enforce are the same `Owner` value passed in here.
 *
 * Uses the real seeded catalogue, because `applyAddToCart` re-prices
 * server-side and refuses anything that does not genuinely price — a
 * hand-built fake product would simply be rejected, and every test below
 * would pass without exercising anything.
 */

const PREFIX = 'test-cart-ops-';
const PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

let cachedSelections: Selections | null = null;

/** The first option combination of the real seeded product that genuinely prices — never a hardcoded id or size, both of which rot when the seed changes. */
async function priceableSelections(): Promise<Selections> {
  if (cachedSelections !== null) {
    return cachedSelections;
  }
  const data = await getConfiguratorProductData(PRODUCT_SLUG);
  if (data === null) {
    throw new Error(`No "${PRODUCT_SLUG}" in this database — seed it first (npm run db:seed against TEST_DATABASE_URL)`);
  }
  const sizes = [0.5, 0.75, 0.35, 1].map((fraction) => ({
    widthMm: Math.round(data.product.minWidthMm + (data.product.maxWidthMm - data.product.minWidthMm) * fraction),
    heightMm: Math.round(data.product.minHeightMm + (data.product.maxHeightMm - data.product.minHeightMm) * fraction),
  }));
  for (const designId of data.designsById.keys()) {
    for (const materialId of data.materialsById.keys()) {
      for (const finishId of [...data.finishesById.keys(), null]) {
        for (const size of sizes) {
          const selections: Selections = {
            designId,
            customUploadId: null,
            materialId,
            widthMm: size.widthMm,
            heightMm: size.heightMm,
            thicknessMm: null,
            finishId,
            installationVariant: null,
            personalizationText: null,
            fontId: null,
          };
          if ((await priceAndValidateSelections(PRODUCT_SLUG, selections)) !== null) {
            cachedSelections = selections;
            return selections;
          }
        }
      }
    }
  }
  throw new Error(`No priceable option combination for "${PRODUCT_SLUG}" — the seeded catalogue changed`);
}

function guestOwner(sessionToken: string): Owner {
  return { userId: null, sessionToken };
}

async function readCart(sessionToken: string) {
  return findCartForRequest({ userId: null, sessionToken });
}

afterEach(async () => {
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.analyticsEvent.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

describe('addToCart — line identity (audit P1-4)', () => {
  it('adding the identical configuration twice bumps the quantity instead of creating a second row', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
  });

  it('a double-clicked "add to cart" — two genuinely concurrent requests — still leaves one row', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();

    await Promise.all([
      applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1),
      applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1),
    ]);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(1);
  });

  it('adding the same product at a different size creates a genuinely separate line', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    const wider: Selections = { ...selections, widthMm: (selections.widthMm ?? 700) - 10 };
    // Only meaningful if the variant also prices — otherwise this would
    // assert "one row" for the boring reason that the second add failed.
    const variantPrices = (await priceAndValidateSelections(PRODUCT_SLUG, wider)) !== null;

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const second = await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, wider, [], 1);

    const cart = await readCart(sessionToken);
    expect(second.ok).toBe(variantPrices);
    expect(cart.items).toHaveLength(variantPrices ? 2 : 1);
  });

  it('adding the same product with different engraved text creates a genuinely separate line', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    const engraved: Selections = { ...selections, personalizationText: 'Anna' };
    const engravedPrices = (await priceAndValidateSelections(PRODUCT_SLUG, engraved)) !== null;

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, engraved, [], 1);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(engravedPrices ? 2 : 1);
  });

  it('duplicating a line still produces a second independent row, never a quantity bump', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const before = await readCart(sessionToken);
    const cartItemId = before.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed — nothing in the cart to duplicate');

    await applyDuplicateCartItem(guestOwner(sessionToken), cartItemId);

    const after = await readCart(sessionToken);
    expect(after.items).toHaveLength(2);
    // Two independent drafts: editing one must not touch the other.
    expect(after.items[0]?.configurationId).not.toBe(after.items[1]?.configurationId);
  });

  it('merging never pushes a line past the real maximum quantity', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], MAX_CART_ITEM_QUANTITY);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], MAX_CART_ITEM_QUANTITY);

    const cart = await readCart(sessionToken);
    expect(cart.items[0]?.quantity).toBe(MAX_CART_ITEM_QUANTITY);
  });
});

describe('adjustCartItemQuantity — concurrency (audit P0-3)', () => {
  async function seedOneItem(sessionToken: string): Promise<string> {
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const cart = await readCart(sessionToken);
    const cartItemId = cart.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed — nothing in the cart');
    return cartItemId;
  }

  it('two concurrent increments both land — neither is silently lost', async () => {
    const sessionToken = uid();
    const cartItemId = await seedOneItem(sessionToken);

    await Promise.all([
      applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1),
      applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1),
    ]);

    const cart = await readCart(sessionToken);
    expect(cart.items[0]?.quantity).toBe(3);
  });

  it('many concurrent increments all land', async () => {
    const sessionToken = uid();
    const cartItemId = await seedOneItem(sessionToken);

    await Promise.all(
      Array.from({ length: 8 }, () => applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1)),
    );

    const cart = await readCart(sessionToken);
    expect(cart.items[0]?.quantity).toBe(9);
  });

  it('an increment and a decrement racing cancel out rather than one overwriting the other', async () => {
    const sessionToken = uid();
    const cartItemId = await seedOneItem(sessionToken);
    await applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1);

    await Promise.all([
      applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1),
      applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, -1),
    ]);

    const cart = await readCart(sessionToken);
    expect(cart.items[0]?.quantity).toBe(2);
  });

  it('cannot be pushed past the maximum, however many increments race', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], MAX_CART_ITEM_QUANTITY);
    const cart = await readCart(sessionToken);
    const cartItemId = cart.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed — nothing in the cart');

    await Promise.all(
      Array.from({ length: 5 }, () => applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, 1)),
    );

    expect((await readCart(sessionToken)).items[0]?.quantity).toBe(MAX_CART_ITEM_QUANTITY);
  });

  it('cannot be pushed below one, however many decrements race', async () => {
    const sessionToken = uid();
    const cartItemId = await seedOneItem(sessionToken);

    await Promise.all(
      Array.from({ length: 5 }, () => applyAdjustCartItemQuantity(guestOwner(sessionToken), cartItemId, -1)),
    );

    expect((await readCart(sessionToken)).items[0]?.quantity).toBe(1);
  });
});

describe('cart ownership (audit — §16.1 re-derives the actor, never trusts an id)', () => {
  it('one guest cannot adjust another guest’s cart item', async () => {
    const mine = uid();
    const theirs = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(theirs), theirs, PRODUCT_SLUG, selections, [], 1);
    const victim = await readCart(theirs);
    const cartItemId = victim.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await applyAdjustCartItemQuantity(guestOwner(mine), cartItemId, 1);

    expect((await readCart(theirs)).items[0]?.quantity).toBe(1);
  });

  it('one guest cannot remove another guest’s cart item', async () => {
    const mine = uid();
    const theirs = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(theirs), theirs, PRODUCT_SLUG, selections, [], 1);
    const victim = await readCart(theirs);
    const cartItemId = victim.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await applyRemoveCartItem(guestOwner(mine), cartItemId);

    expect((await readCart(theirs)).items).toHaveLength(1);
  });

  it('a caller with no identity at all cannot touch anything', async () => {
    const theirs = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(theirs), theirs, PRODUCT_SLUG, selections, [], 1);
    const victim = await readCart(theirs);
    const cartItemId = victim.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await applyRemoveCartItem({ userId: null, sessionToken: null }, cartItemId);

    expect((await readCart(theirs)).items).toHaveLength(1);
  });

  it('removing the same item twice is not an error — a double-clicked bin icon must not 500', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const cart = await readCart(sessionToken);
    const cartItemId = cart.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await applyRemoveCartItem(guestOwner(sessionToken), cartItemId);
    await expect(applyRemoveCartItem(guestOwner(sessionToken), cartItemId)).resolves.toBeUndefined();

    expect((await readCart(sessionToken)).items).toHaveLength(0);
  });
});

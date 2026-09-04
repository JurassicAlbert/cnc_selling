import { afterEach, describe, expect, it } from 'vitest';

import { MAX_CART_ITEM_QUANTITY } from '@/domain/cart/quantity';
import type { Selections } from '@/domain/configuration/steps';
import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { resolveOptions } from '@/server/configurator/resolve-options';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { findCartForRequest } from '@/server/repositories/cart';
import {
  applyAddToCart,
  applyAdjustCartItemQuantity,
  applyDeleteConfiguration,
  applyDuplicateCartItem,
  applyRemoveCartItem,
  applyUpdateCartItemConfiguration,
} from '@/server/operations/cart';
import type { Owner } from '@/server/session/ownership';

/**
 * The realistic-user-behaviour half of `docs/AUDIT-2026-08-30.md`: the
 * things a real person does that a developer clicking carefully once never
 * sees. Double-clicking. Clicking `+` twice before the page catches up.
 * Two tabs.
 *
 * These run against the real cart operations rather than the Server Actions
 * that wrap them - the wrappers call `cookies()`, which throws outside a
 * request scope, and separating the two is exactly what made this testable
 * (see `src/server/operations/cart.ts`'s header). The ownership rules the
 * wrappers enforce are the same `Owner` value passed in here.
 *
 * Uses the real seeded catalogue, because `applyAddToCart` re-prices
 * server-side and refuses anything that does not genuinely price - a
 * hand-built fake product would simply be rejected, and every test below
 * would pass without exercising anything.
 */

const PREFIX = 'test-cart-ops-';
const PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

let cachedSelections: Selections | null = null;

/** The first option combination of the real seeded product that genuinely prices - never a hardcoded id or size, both of which rot when the seed changes. */
async function priceableSelections(): Promise<Selections> {
  if (cachedSelections !== null) {
    return cachedSelections;
  }
  const data = await getConfiguratorProductData(PRODUCT_SLUG);
  if (data === null) {
    throw new Error(`No "${PRODUCT_SLUG}" in this database - seed it first (npm run db:seed against TEST_DATABASE_URL)`);
  }
  const sizes = [0.5, 0.75, 0.35, 1].map((fraction) => ({
    widthMm: Math.round(data.product.minWidthMm + (data.product.maxWidthMm - data.product.minWidthMm) * fraction),
    heightMm: Math.round(data.product.minHeightMm + (data.product.maxHeightMm - data.product.minHeightMm) * fraction),
  }));
  // Iterate what a customer can actually PICK, not every row that happens
  // to be joined to the product. `designsById`/`materialsById` are
  // deliberately unfiltered (they exist to resolve an id, not to offer
  // one), so they still contain retired rows - since 2026-08-31 that
  // includes the deactivated `wzor-podstawowy` placeholder. Walking those
  // meant ~48 pointless round trips, each correctly refused with
  // `OPTION_UNAVAILABLE`, before reaching a sellable design - enough to
  // blow this test's timeout under parallel load.
  const offered = resolveOptions(data.options, EMPTY_SELECTIONS);
  for (const designId of offered.designIds) {
    for (const materialId of offered.materialIds) {
      const finishIds = resolveOptions(data.options, { ...EMPTY_SELECTIONS, materialId }).finishIds;
      for (const finishId of [...finishIds, null]) {
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
          if ((await priceAndValidateSelections(PRODUCT_SLUG, selections)).ok) {
            cachedSelections = selections;
            return selections;
          }
        }
      }
    }
  }
  throw new Error(`No priceable option combination for "${PRODUCT_SLUG}" - the seeded catalogue changed`);
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

describe('addToCart - line identity (audit P1-4)', () => {
  it('adding the identical configuration twice bumps the quantity instead of creating a second row', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
  });

  it('a double-clicked "add to cart" - two genuinely concurrent requests - still leaves one row', async () => {
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
    // Only meaningful if the variant also prices - otherwise this would
    // assert "one row" for the boring reason that the second add failed.
    const variantPrices = (await priceAndValidateSelections(PRODUCT_SLUG, wider)).ok;

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
    const engravedPrices = (await priceAndValidateSelections(PRODUCT_SLUG, engraved)).ok;

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, engraved, [], 1);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(engravedPrices ? 2 : 1);
  });

  /**
   * This assertion used to be the exact opposite - "duplicating a line still
   * produces a second independent row, never a quantity bump" - and the
   * `CartItem` schema comment said the same. The owner reversed it on
   * 2026-08-30: "duplicate the same product in basket like separate product
   * since its the same only the quantity should change." Recorded here
   * rather than quietly swapped, because the old behaviour was deliberate
   * and someone reading the schema comment will otherwise think this is a
   * regression.
   */
  it('duplicating an unchanged line raises its quantity rather than adding a twin', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const before = await readCart(sessionToken);
    const cartItemId = before.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed - nothing in the cart to duplicate');

    await applyDuplicateCartItem(guestOwner(sessionToken), cartItemId);

    const after = await readCart(sessionToken);
    expect(after.items).toHaveLength(1);
    expect(after.items[0]?.quantity).toBe(2);
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

describe('adjustCartItemQuantity - concurrency (audit P0-3)', () => {
  async function seedOneItem(sessionToken: string): Promise<string> {
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const cart = await readCart(sessionToken);
    const cartItemId = cart.items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed - nothing in the cart');
    return cartItemId;
  }

  it('two concurrent increments both land - neither is silently lost', async () => {
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
    if (cartItemId === undefined) throw new Error('setup failed - nothing in the cart');

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

describe('cart ownership (audit - §16.1 re-derives the actor, never trusts an id)', () => {
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

  it('removing the same item twice is not an error - a double-clicked bin icon must not 500', async () => {
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

/**
 * 2026-08-30, owner: "client should not be able to save the same project
 * twice" and "duplicate the same product in basket like separate product
 * since its the same only the quantity should change".
 *
 * The signature merge added earlier closed the add-to-cart path only. Three
 * others were still open, and each produces a genuinely identical row a
 * customer then has to clean up by hand:
 *
 *   1. Removing a line and re-adding the same thing created a SECOND
 *      identical `Configuration`, which `/moje-konto/projekty` lists - the
 *      "saved the same project twice" case, and the one with no UI to
 *      resolve it.
 *   2. "Duplikuj" deliberately created a second identical line.
 *   3. Editing a line into something another line already is left both.
 */
describe('no two identical lines, by any path (owner request, 2026-08-30)', () => {
  async function seedOneLine(sessionToken: string) {
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const cart = await readCart(sessionToken);
    const item = cart.items[0];
    if (item === undefined) throw new Error('setup failed - nothing in the cart');
    return { selections, item };
  }

  it('re-adding after removing does not leave a second saved project behind', async () => {
    const sessionToken = uid();
    const { selections, item } = await seedOneLine(sessionToken);

    await applyRemoveCartItem(guestOwner(sessionToken), item.cartItemId);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);

    // One line in the cart, and - the actual bug - exactly ONE Configuration
    // row, not two. `/moje-konto/projekty` lists these directly.
    expect((await readCart(sessionToken)).items).toHaveLength(1);
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(1);
  });

  it('adding, removing and re-adding several times still leaves one saved project', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    for (let round = 0; round < 3; round += 1) {
      await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
      const cart = await readCart(sessionToken);
      const cartItemId = cart.items[0]?.cartItemId;
      if (cartItemId === undefined) throw new Error('setup failed');
      await applyRemoveCartItem(guestOwner(sessionToken), cartItemId);
    }
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(1);
  });

  it('"Duplikuj" on an unchanged line raises its quantity instead of adding a second identical line', async () => {
    const sessionToken = uid();
    const { item } = await seedOneLine(sessionToken);

    await applyDuplicateCartItem(guestOwner(sessionToken), item.cartItemId);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
    // And no orphan Configuration left behind by the copy that wasn't made.
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(1);
  });

  /**
   * T-07 - `docs/REVIEW-DETAILED.md` BUG-05. The test above is sequential
   * and passed both before and after the fix, which is exactly why this one
   * exists: `applyDuplicateCartItem` read the quantity and wrote it back,
   * the same lost-update shape `docs/AUDIT-2026-08-30.md` P0-3 had already
   * found and fixed in `applyAdjustCartItemQuantity` **in the same commit**.
   * "Duplikuj" is a zero-JS `<form action>` with nothing disabling it, so two
   * rapid clicks both read 1 and both wrote 2 - the customer clicked twice
   * and got one increment.
   */
  it('two concurrent duplicates both land - neither is silently lost', async () => {
    const sessionToken = uid();
    const { item } = await seedOneLine(sessionToken);

    await Promise.all([
      applyDuplicateCartItem(guestOwner(sessionToken), item.cartItemId),
      applyDuplicateCartItem(guestOwner(sessionToken), item.cartItemId),
    ]);

    const cart = await readCart(sessionToken);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(3);
    // Still one Configuration: neither call may leave an orphan behind.
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(1);
  });

  it('many concurrent duplicates all land', async () => {
    const sessionToken = uid();
    const { item } = await seedOneLine(sessionToken);

    await Promise.all(
      Array.from({ length: 8 }, () => applyDuplicateCartItem(guestOwner(sessionToken), item.cartItemId)),
    );

    expect((await readCart(sessionToken)).items[0]?.quantity).toBe(9);
  });

  it('concurrent duplicates at the boundary stop at the maximum, not past it', async () => {
    // The clamp has to live in the WHERE clause for this to hold: applied
    // after a read, two racing calls could each read 24 and each write 25 -
    // right answer by luck - or, one short of the cap, both write 26.
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(
      guestOwner(sessionToken),
      sessionToken,
      PRODUCT_SLUG,
      selections,
      [],
      MAX_CART_ITEM_QUANTITY - 1,
    );
    const cartItemId = (await readCart(sessionToken)).items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await Promise.all(
      Array.from({ length: 4 }, () => applyDuplicateCartItem(guestOwner(sessionToken), cartItemId)),
    );

    expect((await readCart(sessionToken)).items[0]?.quantity).toBe(MAX_CART_ITEM_QUANTITY);
  });

  it('duplicating never pushes past the maximum quantity', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], MAX_CART_ITEM_QUANTITY);
    const cartItemId = (await readCart(sessionToken)).items[0]?.cartItemId;
    if (cartItemId === undefined) throw new Error('setup failed');

    await applyDuplicateCartItem(guestOwner(sessionToken), cartItemId);

    expect((await readCart(sessionToken)).items[0]?.quantity).toBe(MAX_CART_ITEM_QUANTITY);
  });

  it('editing one line into exactly what another line already is merges them', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    const variant: Selections = { ...selections, personalizationText: 'Anna' };
    if (!(await priceAndValidateSelections(PRODUCT_SLUG, variant)).ok) {
      // The seeded product does not price with engraved text; nothing to assert.
      return;
    }

    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, variant, [], 2);
    const before = await readCart(sessionToken);
    expect(before.items).toHaveLength(2);
    const variantLine = before.items.find((line) => line.personalizationText === 'Anna');
    if (variantLine === undefined) throw new Error('setup failed - no variant line');

    // Edit the variant back into the plain configuration the other line is.
    await applyUpdateCartItemConfiguration(
      guestOwner(sessionToken),
      variantLine.configurationId,
      PRODUCT_SLUG,
      selections,
      [],
    );

    const after = await readCart(sessionToken);
    expect(after.items).toHaveLength(1);
    // The edited line's quantity is carried over, not discarded.
    expect(after.items[0]?.quantity).toBe(3);
  });
});

/**
 * 2026-08-30 sweep, adjacent to the duplicate work: a customer could
 * accumulate saved projects but never remove one. That is why duplicates
 * felt permanent - there was no remedy for the ones already there, only a
 * fix for new ones.
 *
 * Safe to delete outright, unlike an uploaded design: nothing historical
 * references a `Configuration`. `OrderItem` holds an immutable snapshot and
 * never joins back to it (`OrderItem.snapshot`'s own schema comment), so a
 * past order cannot be changed by removing one. `CartItem` is the only real
 * reference, and that is exactly what the guard below is about.
 */
describe('deleting a saved project', () => {
  it('removes it, and it stops being listed', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const cart = await readCart(sessionToken);
    const cartItemId = cart.items[0]?.cartItemId;
    const configurationId = cart.items[0]?.configurationId;
    if (cartItemId === undefined || configurationId === undefined) throw new Error('setup failed');
    // Take it out of the cart first - a project still in the cart is a
    // different case, covered below.
    await applyRemoveCartItem(guestOwner(sessionToken), cartItemId);

    const result = await applyDeleteConfiguration(guestOwner(sessionToken), configurationId);

    expect(result).toBe(true);
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(0);
  });

  it('refuses to delete one that is still in the cart, rather than breaking the cart', async () => {
    const sessionToken = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(sessionToken), sessionToken, PRODUCT_SLUG, selections, [], 1);
    const configurationId = (await readCart(sessionToken)).items[0]?.configurationId;
    if (configurationId === undefined) throw new Error('setup failed');

    const result = await applyDeleteConfiguration(guestOwner(sessionToken), configurationId);

    expect(result).toBe(false);
    expect((await readCart(sessionToken)).items).toHaveLength(1);
    expect(await prisma.configuration.count({ where: { sessionToken } })).toBe(1);
  });

  it('never deletes another owner’s saved project', async () => {
    const mine = uid();
    const theirs = uid();
    const selections = await priceableSelections();
    await applyAddToCart(guestOwner(theirs), theirs, PRODUCT_SLUG, selections, [], 1);
    const victim = await readCart(theirs);
    const cartItemId = victim.items[0]?.cartItemId;
    const configurationId = victim.items[0]?.configurationId;
    if (cartItemId === undefined || configurationId === undefined) throw new Error('setup failed');
    await applyRemoveCartItem(guestOwner(theirs), cartItemId);

    expect(await applyDeleteConfiguration(guestOwner(mine), configurationId)).toBe(false);
    expect(await prisma.configuration.count({ where: { sessionToken: theirs } })).toBe(1);
  });
});

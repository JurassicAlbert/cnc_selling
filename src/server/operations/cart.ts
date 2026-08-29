/**
 * Cart mutations — the real logic, as plain functions taking an explicit
 * `Owner` (`src/server/actions/cart.ts` is the thin `'use server'` half that
 * derives that owner from the real session and never trusts one from the
 * request). Same split as every other `operations/` module — see
 * `docs/AUDIT-2026-08-30.md` P0-1 for why the two halves must not share a
 * module, and note that these functions are *not* exported from a
 * `'use server'` file, so an `Owner` passed in here can only ever have come
 * from server code that already authenticated the caller.
 *
 * Splitting them out is also what made the concurrency behaviour testable
 * at all: the wrappers call `cookies()`/`headers()`, which throw outside a
 * real request, so nothing below could previously be driven from a test.
 *
 * Ownership rules are unchanged from before the split (§16.1: "`Configuration`…
 * access requires `userId` match **or** matching guest `sessionToken`"),
 * as is the discipline that `addToCart`/`updateCartItemConfiguration`
 * re-validate and re-price server-side rather than trusting a submitted
 * price (§10.2).
 *
 * Two 2026-08-30 audit fixes live here:
 *
 *   - P0-3: `applyAdjustCartItemQuantity` no longer reads a quantity and
 *     writes it back. Two rapid `+` clicks used to both read 1 and both
 *     write 2 — one increment silently lost.
 *   - P1-4: `applyAddToCart` merges into an existing line when the
 *     configuration is byte-identical, instead of creating a second
 *     identical row.
 */

import type { Selections } from '@/domain/configuration/steps';
import { MAX_CART_ITEM_QUANTITY, MIN_CART_ITEM_QUANTITY, clampCartQuantity } from '@/domain/cart/quantity';
import { cartItemSignature } from '@/domain/cart/signature';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import type { InstallationVariantCode } from '@/generated/prisma/enums';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { findOwnedDesignId } from '@/server/repositories/design-review';
import type { Owner } from '@/server/session/ownership';
import { hasNoOwner, ownerOrClauses } from '@/server/session/ownership';

/**
 * Prisma's JSON input type isn't structurally compatible with the plain
 * `readonly`-heavy domain types (`ModuleLayout`, `PriceBreakdown`,
 * `FeasibilityFinding[]`) even though every value is genuinely
 * JSON-serializable — this makes that intentional double-cast a single,
 * named, auditable spot instead of an unchecked `as never` scattered
 * through the file (which would silently accept ANY type, JSON-safe or
 * not).
 */
function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * `selections.customUploadId` names a `CustomerDesign` row the client
 * chose to attach — per §16.1, an id from the request is never trusted
 * on its own, so this re-derives ownership the same way
 * `requireOwnedCartItem`/`requireOwnedConfiguration` do: the row must
 * actually belong to the caller's own owner, or this rejects the whole
 * submission. `null` (no custom design attached) always passes — there's
 * nothing to own.
 */
async function verifyOwnedCustomDesign(customDesignId: string | null, owner: Owner): Promise<boolean> {
  if (customDesignId === null) {
    return true;
  }
  return findOwnedDesignId(customDesignId, owner);
}

export type AddToCartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'CONFIGURATION_INVALID' };

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

/**
 * This visitor's cart, created if they don't have one yet.
 *
 * `Cart.userId` is `@unique` — a logged-in customer's cart is keyed by
 * that, never re-touching `sessionToken` (already retired onto this cart by
 * `mergeGuestCartIntoUser` at login, if there was one to merge).
 *
 * `upsert` is NOT atomic against a concurrent insert of the same key: it
 * reads, finds nothing, and inserts, so two simultaneous first-additions
 * both try to create the same cart and the loser gets a unique-constraint
 * error. A real 500 for a customer whose very first action on the site was
 * double-clicking "Dodaj do koszyka" — found by
 * `tests/integration/cart-operations.test.ts`, not by anyone clicking
 * carefully once. The retry resolves it: by then the winner's row exists,
 * so the second attempt reads it instead of inserting.
 */
async function ensureCart(owner: Owner, sessionToken: string): Promise<{ readonly id: string }> {
  const where = owner.userId !== null ? { userId: owner.userId } : { sessionToken };
  const create = owner.userId !== null ? { userId: owner.userId } : { sessionToken };
  try {
    return await prisma.cart.upsert({ where, create, update: {}, select: { id: true } });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
    const existing = await prisma.cart.findUnique({ where, select: { id: true } });
    if (existing === null) {
      throw error;
    }
    return existing;
  }
}

export async function applyAddToCart(
  owner: Owner,
  sessionToken: string,
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
  quantity: number,
): Promise<AddToCartResult> {
  const validated = await priceAndValidateSelections(productSlug, selections);
  if (validated === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const { data, pricing } = validated;

  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }

  const cart = await ensureCart(owner, sessionToken);

  const signature = cartItemSignature(data.productId, selections);

  const addOrMerge = () =>
    prisma.$transaction(async (tx) => {
      // The identical line already in this cart, if there is one — adding
      // the same thing again is a quantity change, not a second line
      // (`docs/AUDIT-2026-08-30.md` P1-4). Two DIFFERENT configurations
      // produce two different signatures and stay two rows, unchanged.
      const existing = await tx.cartItem.findUnique({
        where: { cartId_configurationSignature: { cartId: cart.id, configurationSignature: signature } },
        select: { id: true, quantity: true },
      });
      if (existing !== null) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: clampCartQuantity(existing.quantity + quantity) },
        });
        return;
      }

      // Always stamped with `sessionToken`, logged in or not:
      // `Configuration.sessionToken` keeps working as a fallback ownership
      // path for anything created before this visit's login (§16.1's
      // "userId match OR matching sessionToken").
      const configuration = await tx.configuration.create({
        data: {
          userId: owner.userId,
          sessionToken,
          productId: data.productId,
          designId: selections.designId,
          customDesignId: selections.customUploadId,
          materialId: selections.materialId,
          finishId: selections.finishId,
          thicknessMm: selections.thicknessMm,
          widthMm: selections.widthMm,
          heightMm: selections.heightMm,
          installVariant: selections.installationVariant as InstallationVariantCode | null,
          personalizationText: selections.personalizationText,
          fontId: selections.fontId,
          moduleCount: pricing.moduleLayout.totalModules,
          moduleLayout: toJsonInput(pricing.moduleLayout),
          priceBreakdown: toJsonInput(pricing.priceBreakdown),
          priceGrossGrosze: pricing.priceBreakdown.unitGrossGrosze,
          warnings: toJsonInput(pricing.feasibility),
          acknowledgedWarnings: [...acknowledgedWarnings],
          pricingVersion: pricing.priceBreakdown.pricingVersion,
          isComplete: true,
        },
      });

      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          configurationId: configuration.id,
          configurationSignature: signature,
          quantity: clampCartQuantity(quantity),
        },
      });
    });

  try {
    await addOrMerge();
  } catch (error) {
    // Two genuinely concurrent additions of the same configuration: both
    // found no existing line, both tried to insert it, and the unique index
    // rejected the loser. Retrying is enough — the winner's row is now
    // committed, so the second pass takes the merge branch above. Exactly
    // one retry: a second failure would mean something other than this race.
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
    await addOrMerge();
  }

  void recordAnalyticsEvent({
    name: 'add_to_cart',
    sessionToken,
    userId: owner.userId,
    productId: data.productId,
  });

  return { ok: true };
}

async function findOwnedCartItem(cartItemId: string, owner: Owner) {
  if (hasNoOwner(owner)) {
    return null;
  }
  return prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { OR: ownerOrClauses(owner) } },
    select: { id: true, configurationId: true, cartId: true },
  });
}

/**
 * A direct set, so there is no read-modify-write to lose: whatever number
 * arrives is clamped and written. A direct POST with `quantity=10000`
 * bypassing the UI entirely still lands at `MAX_CART_ITEM_QUANTITY`.
 */
export async function applyUpdateCartItemQuantity(owner: Owner, cartItemId: string, quantity: number): Promise<void> {
  if (!Number.isFinite(quantity)) {
    return;
  }
  const owned = await findOwnedCartItem(cartItemId, owner);
  if (owned === null) {
    return;
  }
  await prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity: clampCartQuantity(quantity) } });
}

/**
 * The cart page's +/- stepper. `docs/AUDIT-2026-08-30.md` P0-3: this used
 * to read the current quantity and write back `current + delta`, so two
 * rapid clicks both read 1 and both wrote 2 — the customer clicked twice
 * and got one increment.
 *
 * The bound lives in the WHERE clause rather than in a clamp applied
 * afterwards, which is what makes this a single atomic statement
 * (`UPDATE … SET quantity = quantity + 1 WHERE id = … AND quantity < 25`):
 * concurrent adjustments compose instead of overwriting each other, and
 * neither can push past the real limit. An update matching no row means the
 * item is already at the boundary — a no-op, not an error, exactly as the
 * disabled button in the UI implies.
 */
export async function applyAdjustCartItemQuantity(owner: Owner, cartItemId: string, delta: 1 | -1): Promise<void> {
  const owned = await findOwnedCartItem(cartItemId, owner);
  if (owned === null) {
    return;
  }
  if (delta === 1) {
    await prisma.cartItem.updateMany({
      where: { id: cartItemId, quantity: { lt: MAX_CART_ITEM_QUANTITY } },
      data: { quantity: { increment: 1 } },
    });
    return;
  }
  await prisma.cartItem.updateMany({
    where: { id: cartItemId, quantity: { gt: MIN_CART_ITEM_QUANTITY } },
    data: { quantity: { decrement: 1 } },
  });
}

export async function applyRemoveCartItem(owner: Owner, cartItemId: string): Promise<void> {
  const owned = await findOwnedCartItem(cartItemId, owner);
  if (owned === null) {
    return;
  }
  // `deleteMany`, not `delete`: a concurrent removal of the same row (two
  // tabs, a double-clicked bin icon) would make the second `delete` throw
  // "record not found" and surface as a server error, for an outcome the
  // customer already got.
  await prisma.cartItem.deleteMany({ where: { id: cartItemId } });
}

/** Deep-copies the `Configuration` row — a duplicate is a second independent draft, not a quantity bump. */
export async function applyDuplicateCartItem(owner: Owner, cartItemId: string): Promise<void> {
  const owned = await findOwnedCartItem(cartItemId, owner);
  if (owned === null) {
    return;
  }
  const original = await prisma.configuration.findUniqueOrThrow({ where: { id: owned.configurationId } });
  const copy = await prisma.configuration.create({
    data: {
      sessionToken: original.sessionToken,
      userId: original.userId,
      productId: original.productId,
      designId: original.designId,
      customDesignId: original.customDesignId,
      materialId: original.materialId,
      finishId: original.finishId,
      thicknessMm: original.thicknessMm,
      widthMm: original.widthMm,
      heightMm: original.heightMm,
      installVariant: original.installVariant,
      personalizationText: original.personalizationText,
      fontId: original.fontId,
      moduleCount: original.moduleCount,
      moduleLayout: toJsonInput(original.moduleLayout),
      priceBreakdown: toJsonInput(original.priceBreakdown),
      priceGrossGrosze: original.priceGrossGrosze,
      warnings: toJsonInput(original.warnings),
      acknowledgedWarnings: original.acknowledgedWarnings,
      pricingVersion: original.pricingVersion,
      isComplete: original.isComplete,
    },
  });
  const cartItem = await prisma.cartItem.findUnique({ where: { id: cartItemId }, select: { cartId: true, quantity: true } });
  if (cartItem === null) {
    return;
  }
  await prisma.cartItem.create({
    data: {
      cartId: cartItem.cartId,
      configurationId: copy.id,
      // A duplicate is deliberately its OWN line, so it must never collide
      // with the line it was copied from — the copy's `Configuration` id is
      // what keeps it distinct, and stays distinct if the original is later
      // edited into something else.
      configurationSignature: `copy:${copy.id}`,
      quantity: cartItem.quantity,
    },
  });
}

/**
 * `Configuration` carries its own `userId`/`sessionToken` (§16.1:
 * "`Configuration`... access requires `userId` match or matching guest
 * `sessionToken`") — checked directly, not via a `CartItem` join. The
 * "Edytuj" link on the cart page encodes the `Configuration` id, not the
 * `CartItem` id, precisely so this can be verified this way.
 */
async function ownsConfiguration(configurationId: string, owner: Owner): Promise<boolean> {
  if (hasNoOwner(owner)) {
    return false;
  }
  const configuration = await prisma.configuration.findFirst({
    where: { id: configurationId, OR: ownerOrClauses(owner) },
    select: { id: true },
  });
  return configuration !== null;
}

export async function applyUpdateCartItemConfiguration(
  owner: Owner,
  configurationId: string,
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
): Promise<AddToCartResult> {
  if (!(await ownsConfiguration(configurationId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const validated = await priceAndValidateSelections(productSlug, selections);
  if (validated === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const { data, pricing } = validated;

  await prisma.configuration.update({
    where: { id: configurationId },
    data: {
      designId: selections.designId,
      customDesignId: selections.customUploadId,
      materialId: selections.materialId,
      finishId: selections.finishId,
      thicknessMm: selections.thicknessMm,
      widthMm: selections.widthMm,
      heightMm: selections.heightMm,
      installVariant: selections.installationVariant as InstallationVariantCode | null,
      personalizationText: selections.personalizationText,
      fontId: selections.fontId,
      moduleCount: pricing.moduleLayout.totalModules,
      moduleLayout: toJsonInput(pricing.moduleLayout),
      priceBreakdown: toJsonInput(pricing.priceBreakdown),
      priceGrossGrosze: pricing.priceBreakdown.unitGrossGrosze,
      warnings: toJsonInput(pricing.feasibility),
      acknowledgedWarnings: [...acknowledgedWarnings],
      pricingVersion: pricing.priceBreakdown.pricingVersion,
      isComplete: true,
    },
  });

  // The line's identity moved with it. Editing a line into something a
  // DIFFERENT line in the same cart already is would violate the unique
  // index — an honest collision, not a crash: the edit is kept (the
  // configuration is already updated and correct) and the line keeps its
  // old signature, so the two simply stay separate rows rather than one
  // silently swallowing the other's quantity.
  const signature = cartItemSignature(data.productId, selections);
  await prisma.cartItem
    .updateMany({ where: { configurationId }, data: { configurationSignature: signature } })
    .catch((error: unknown) => {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
    });

  return { ok: true };
}

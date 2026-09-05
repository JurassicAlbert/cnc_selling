/**
 * Cart mutations - the real logic, as plain functions taking an explicit
 * `Owner` (`src/server/actions/cart.ts` is the thin `'use server'` half that
 * derives that owner from the real session and never trusts one from the
 * request). Same split as every other `operations/` module - see
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
 *     write 2 - one increment silently lost.
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
import { parseAcknowledgedWarnings } from '@/domain/configuration/input-schema';
import type { PricingRejectionCode } from '@/server/configurator/validate-and-price';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { findOwnedDesignId } from '@/server/repositories/design-review';
import type { Owner } from '@/server/session/ownership';
import { hasNoOwner, ownerOrClauses } from '@/server/session/ownership';

/**
 * Prisma's JSON input type isn't structurally compatible with the plain
 * `readonly`-heavy domain types (`ModuleLayout`, `PriceBreakdown`,
 * `FeasibilityFinding[]`) even though every value is genuinely
 * JSON-serializable - this makes that intentional double-cast a single,
 * named, auditable spot instead of an unchecked `as never` scattered
 * through the file (which would silently accept ANY type, JSON-safe or
 * not).
 */
function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * `selections.customUploadId` names a `CustomerDesign` row the client
 * chose to attach - per §16.1, an id from the request is never trusted
 * on its own, so this re-derives ownership the same way
 * `requireOwnedCartItem`/`requireOwnedConfiguration` do: the row must
 * actually belong to the caller's own owner, or this rejects the whole
 * submission. `null` (no custom design attached) always passes - there's
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
  /**
   * `OPTION_UNAVAILABLE` is deliberately distinct from
   * `CONFIGURATION_INVALID` (`docs/REVIEW-DETAILED.md` SEC-03): it is
   * overwhelmingly a customer holding a saved project or a shared link to
   * something staff have since retired, and telling that person their
   * configuration is "invalid" gives them nothing to act on.
   */
  | { readonly ok: false; readonly code: PricingRejectionCode };

/**
 * A Prisma `where` matching a `Configuration` that IS this exact set of
 * selections - the query form of `cartItemSignature`, which is a string and
 * cannot be queried against rows that predate the column.
 *
 * Every field the signature covers is listed, and that is the point: miss
 * one and two genuinely different configurations start matching each other,
 * which would silently merge a customer's two variants into one line. The
 * unit tests for `cartItemSignature` are the specification both this and
 * that function answer to.
 */
function selectionMatch(productId: string, selections: Selections) {
  return {
    productId,
    designId: selections.designId,
    customDesignId: selections.customUploadId,
    materialId: selections.materialId,
    finishId: selections.finishId,
    thicknessMm: selections.thicknessMm,
    widthMm: selections.widthMm,
    heightMm: selections.heightMm,
    installVariant: selections.installationVariant as InstallationVariantCode | null,
    // Trimmed to match the signature's own normalisation, so " Anna " and
    // "Anna" are one saved project rather than two.
    personalizationText: selections.personalizationText === null ? null : selections.personalizationText.trim(),
    fontId: selections.fontId,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

/**
 * This visitor's cart, created if they don't have one yet.
 *
 * `Cart.userId` is `@unique` - a logged-in customer's cart is keyed by
 * that, never re-touching `sessionToken` (already retired onto this cart by
 * `mergeGuestCartIntoUser` at login, if there was one to merge).
 *
 * `upsert` is NOT atomic against a concurrent insert of the same key: it
 * reads, finds nothing, and inserts, so two simultaneous first-additions
 * both try to create the same cart and the loser gets a unique-constraint
 * error. A real 500 for a customer whose very first action on the site was
 * double-clicking "Dodaj do koszyka" - found by
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
  rawSelections: Selections,
  rawAcknowledgedWarnings: readonly string[],
  quantity: number,
): Promise<AddToCartResult> {
  // BUG-07: this is a public HTTP endpoint's payload. Before the schema,
  // `acknowledgedWarnings` was spread into a `String[]` column with no
  // allow-list, no element count and no length cap.
  const acknowledgedWarnings = parseAcknowledgedWarnings(rawAcknowledgedWarnings);
  if (acknowledgedWarnings === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }

  const validated = await priceAndValidateSelections(productSlug, rawSelections);
  if (!validated.ok) {
    return validated;
  }
  // The PARSED selections from here on, never the caller's - see
  // `ValidatedPricing.selections`.
  const { data, pricing, selections } = validated;

  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }

  const cart = await ensureCart(owner, sessionToken);

  const signature = cartItemSignature(data.productId, selections);

  const addOrMerge = () =>
    prisma.$transaction(async (tx) => {
      // The identical line already in this cart, if there is one - adding
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

      // A line whose signature predates this column (`legacy:` backfill) or
      // was written by "Duplikuj" (`copy:`) can still BE this exact
      // configuration - it just cannot be found by signature. Matching on
      // the configuration's own fields catches it, merges into it, and
      // upgrades its signature so the fast path above handles it next time.
      // Without this, a cart carrying a pre-existing row would keep growing
      // a second identical line forever.
      const legacyMatch = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          configurationSignature: { not: signature },
          configuration: selectionMatch(data.productId, selections),
        },
        select: { id: true, quantity: true },
      });
      if (legacyMatch !== null) {
        await tx.cartItem.update({
          where: { id: legacyMatch.id },
          data: {
            quantity: clampCartQuantity(legacyMatch.quantity + quantity),
            configurationSignature: signature,
          },
        });
        return;
      }

      // An identical configuration this owner already saved - from a line
      // they removed, or one that became an order. Reusing it is the whole
      // point: `/moje-konto/projekty` lists `Configuration` rows directly,
      // so creating a second identical one is exactly "saving the same
      // project twice" (owner, 2026-08-30). Nothing else references a
      // `Configuration` - `OrderItem` holds an immutable snapshot, never a
      // join - so reuse can never disturb a past order.
      const alreadySaved = await tx.configuration.findFirst({
        where: { ...selectionMatch(data.productId, selections), OR: ownerOrClauses(owner) },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (alreadySaved !== null) {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            configurationId: alreadySaved.id,
            configurationSignature: signature,
            quantity: clampCartQuantity(quantity),
          },
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
    // rejected the loser. Retrying is enough - the winner's row is now
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
 * rapid clicks both read 1 and both wrote 2 - the customer clicked twice
 * and got one increment.
 *
 * The bound lives in the WHERE clause rather than in a clamp applied
 * afterwards, which is what makes this a single atomic statement
 * (`UPDATE … SET quantity = quantity + 1 WHERE id = … AND quantity < 25`):
 * concurrent adjustments compose instead of overwriting each other, and
 * neither can push past the real limit. An update matching no row means the
 * item is already at the boundary - a no-op, not an error, exactly as the
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

/**
 * "Duplikuj" - now a quantity change, not a second line.
 *
 * This used to deep-copy the `Configuration` and create an independent row,
 * and both this comment and `CartItem`'s schema comment said so deliberately.
 * The owner reversed it on 2026-08-30: "duplicate the same product in basket
 * like separate product since its the same only the quantity should change."
 *
 * The reversal is right, and the old behaviour had a real cost the original
 * reasoning missed: a duplicate that was never edited left two identical
 * lines the customer had to remove one at a time, AND a second identical
 * `Configuration` row, which `/moje-konto/projekty` then listed as a second
 * saved project. Copying the row only paid for itself if the copy was then
 * edited - and the cart offers no way to edit a line without leaving the
 * page anyway.
 *
 * Bounded by the same `clampCartQuantity` as every other path, so a
 * duplicate cannot push a line past the per-item maximum.
 */
export async function applyDuplicateCartItem(owner: Owner, cartItemId: string): Promise<void> {
  const owned = await findOwnedCartItem(cartItemId, owner);
  if (owned === null) {
    return;
  }
  // Byte-for-byte `applyAdjustCartItemQuantity`'s `+` branch, and for the
  // same reason. `docs/REVIEW-DETAILED.md` BUG-05: when "Duplikuj" became a
  // quantity bump (2026-08-30) it was written as read-then-write - the exact
  // lost-update shape P0-3 had found and fixed in the sibling two functions
  // above, in that same commit. The control is a zero-JS `<form action>`
  // with nothing disabling it, so two rapid clicks both read 1 and both
  // wrote 2.
  //
  // The bound belongs in the WHERE clause, not in a clamp applied after a
  // read: that is what makes this one atomic statement
  // (`UPDATE … SET quantity = quantity + 1 WHERE id = … AND quantity < 25`),
  // so concurrent duplicates compose instead of overwriting each other and
  // none can push past the limit. Matching no row means the line is already
  // at the maximum - a no-op, not an error.
  //
  // The `findUnique` this replaced was redundant as well as racy:
  // `findOwnedCartItem` above has already proved the row exists and is
  // owned.
  await prisma.cartItem.updateMany({
    where: { id: cartItemId, quantity: { lt: MAX_CART_ITEM_QUANTITY } },
    data: { quantity: { increment: 1 } },
  });
}

/**
 * `Configuration` carries its own `userId`/`sessionToken` (§16.1:
 * "`Configuration`... access requires `userId` match or matching guest
 * `sessionToken`") - checked directly, not via a `CartItem` join. The
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
  rawSelections: Selections,
  rawAcknowledgedWarnings: readonly string[],
): Promise<AddToCartResult> {
  const acknowledgedWarnings = parseAcknowledgedWarnings(rawAcknowledgedWarnings);
  if (acknowledgedWarnings === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  if (!(await ownsConfiguration(configurationId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  // Validated BEFORE the ownership check that reads a field off it: with a
  // malformed payload, `selections.customUploadId` could be any type, and
  // handing it to Prisma is the 500 BUG-07 is about. Both paths refuse with
  // the same code, so the reordering changes nothing a caller can observe.
  const validated = await priceAndValidateSelections(productSlug, rawSelections);
  if (!validated.ok) {
    return validated;
  }
  const { data, pricing, selections } = validated;
  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }

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

  // The line's identity moved with it - and editing a line into exactly
  // what a DIFFERENT line in the same cart already is has to MERGE the two,
  // not leave both.
  //
  // This previously caught the unique-index violation and gave up, leaving
  // the cart holding two identical lines: the one that was edited (still
  // carrying its old signature) and the one it now matched. That was the
  // last remaining way to end up with a twin after the owner's 2026-08-30
  // instruction that identical products must only ever differ in quantity.
  // The edited line's quantity is folded into the survivor rather than
  // discarded, so nothing a customer chose is silently lost.
  const signature = cartItemSignature(data.productId, selections);
  await prisma.$transaction(async (tx) => {
    const edited = await tx.cartItem.findFirst({
      where: { configurationId },
      select: { id: true, cartId: true, quantity: true },
    });
    if (edited === null) {
      // A saved configuration edited from `/moje-konto/projekty` with no
      // cart line behind it - nothing to re-key or merge.
      return;
    }
    const twin = await tx.cartItem.findUnique({
      where: { cartId_configurationSignature: { cartId: edited.cartId, configurationSignature: signature } },
      select: { id: true, quantity: true },
    });
    if (twin !== null && twin.id !== edited.id) {
      await tx.cartItem.delete({ where: { id: edited.id } });
      await tx.cartItem.update({
        where: { id: twin.id },
        data: { quantity: clampCartQuantity(twin.quantity + edited.quantity) },
      });
      return;
    }
    await tx.cartItem.update({ where: { id: edited.id }, data: { configurationSignature: signature } });
  });

  return { ok: true };
}

/**
 * Removes a saved project from `/moje-konto/projekty`.
 *
 * 2026-08-30 sweep. A customer could accumulate saved projects but never
 * remove one, which is part of why duplicates felt permanent: the write-side
 * fix stops new ones, but without this there is no remedy for the ones
 * already there.
 *
 * Deleting a `Configuration` outright is safe - unlike a `CustomerDesign`,
 * which `OrderItem` references and which therefore needs a soft delete to
 * respect §16A.2. Nothing historical points at a `Configuration`:
 * `OrderItem` carries an immutable snapshot and never joins back to it, so
 * removing one cannot change what a past order says.
 *
 * `CartItem` IS a real reference, and the one case that has to be refused
 * rather than cascaded: silently emptying a line out of someone's cart
 * because they tidied their saved projects would be a worse surprise than
 * being told to remove it from the cart first.
 *
 * Returns whether anything was deleted, so the caller can say which
 * happened. `false` covers all three "no" cases - not owned, doesn't exist,
 * still in the cart - deliberately without distinguishing them to a
 * caller who might not own the row (§16.2's "don't reveal existence").
 */
export async function applyDeleteConfiguration(owner: Owner, configurationId: string): Promise<boolean> {
  if (!(await ownsConfiguration(configurationId, owner))) {
    return false;
  }
  const inCart = await prisma.cartItem.findFirst({ where: { configurationId }, select: { id: true } });
  if (inCart !== null) {
    return false;
  }
  // `deleteMany`, not `delete`: a double-clicked "Usuń" must not throw
  // "record not found" for an outcome the customer already got - the same
  // reasoning as `applyRemoveCartItem`.
  const deleted = await prisma.configuration.deleteMany({ where: { id: configurationId } });
  return deleted.count > 0;
}

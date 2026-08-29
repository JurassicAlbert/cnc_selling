'use server';

/**
 * Cart mutations. Every action re-derives ownership from the current
 * `Owner` (a real user id when logged in, always also the guest session
 * cookie — see `server/session/ownership.ts`) — never from an id trusted in
 * the request — per `docs/ARCHITECTURE.md` §16.1: "Every Server Action
 * re-derives the actor from the session. No id is ever trusted from the
 * request body."
 *
 * `addToCart`/`updateCartItemConfiguration` re-validate and re-price
 * server-side exactly like `getConfiguratorSnapshot` does (§10.2: prices
 * are never trusted from the client) — the selections a customer submits
 * are re-checked against the real catalogue, never taken on faith.
 *
 * P6: extended from `sessionToken`-only to `Owner` (`userId` OR
 * `sessionToken`) now that real accounts exist — a logged-in customer's
 * cart is keyed by `Cart.userId` (`@unique`), not by the guest cookie,
 * even though that cookie is still minted and still stamped onto every
 * `Configuration` row for continuity with anything created before login.
 */

import { revalidatePath } from 'next/cache';

import type { Selections } from '@/domain/configuration/steps';
import { clampCartQuantity } from '@/domain/cart/quantity';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import type { InstallationVariantCode } from '@/generated/prisma/enums';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { findOwnedDesignId } from '@/server/repositories/design-review';
import { ensureGuestSessionToken } from '@/server/session/guest-session';
import type { Owner } from '@/server/session/ownership';
import { currentOwner, hasNoOwner, ownerOrClauses } from '@/server/session/ownership';

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
 * nothing to own. Delegates the actual check to `design-review.ts`'s
 * `findOwnedDesignId` rather than duplicating the query.
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

export async function addToCart(
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
  // Always minted/read, logged in or not: `Configuration.sessionToken`
  // keeps working as a fallback ownership path for anything created before
  // this visit's login (§16.1's "userId match OR matching sessionToken").
  const sessionToken = await ensureGuestSessionToken();
  const owner = await currentOwner();

  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }

  const configuration = await prisma.configuration.create({
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

  // `Cart.userId` is `@unique` — a logged-in customer's cart is keyed by
  // that, never re-touching `sessionToken` (already retired onto this cart
  // by `mergeGuestCartIntoUser` at login, if there was one to merge).
  const cart =
    owner.userId !== null
      ? await prisma.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {} })
      : await prisma.cart.upsert({ where: { sessionToken }, create: { sessionToken }, update: {} });

  await prisma.cartItem.create({
    data: { cartId: cart.id, configurationId: configuration.id, quantity: clampCartQuantity(quantity) },
  });

  void recordAnalyticsEvent({
    name: 'add_to_cart',
    sessionToken,
    userId: owner.userId,
    productId: data.productId,
  });

  revalidatePath('/koszyk');
  return { ok: true };
}

/**
 * `addToCart` returns a result `useActionState` callers inspect — this
 * fire-and-forget wrapper is for the saved-configurations page's own
 * zero-client-JS `<form action={addSavedConfigurationToCart.bind(null, ...)}>`
 * (`moje-konto/projekty/page.tsx`), which has no inline error UI to show a
 * result to; a re-priced-away-from-valid configuration there just silently
 * doesn't add (same as any other `CONFIGURATION_INVALID` case elsewhere).
 */
export async function addSavedConfigurationToCart(
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
  quantity: number,
): Promise<void> {
  await addToCart(productSlug, selections, acknowledgedWarnings, quantity);
}

async function requireOwnedCartItem(cartItemId: string) {
  const owner = await currentOwner();
  if (hasNoOwner(owner)) {
    return null;
  }
  const cartItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { OR: ownerOrClauses(owner) } },
    select: { id: true, configurationId: true },
  });
  return cartItem;
}

/**
 * `formData` as the trailing parameter — not a plain `quantity: number` —
 * so this can be bound with `.bind(null, cartItemId)` and used directly as
 * a `<form action>` on the cart page's own per-row quantity form, the same
 * zero-client-JS pattern as `CategoryFilterForm`.
 *
 * A non-numeric or missing value is left alone (same "just don't apply it"
 * behaviour as before) — but anything numeric, however large, is clamped
 * through `clampCartQuantity` rather than trusted verbatim. A direct POST
 * with `quantity=10000` bypassing the UI entirely still lands at
 * `MAX_CART_ITEM_QUANTITY`, never higher.
 */
export async function updateCartItemQuantity(cartItemId: string, formData: FormData): Promise<void> {
  const raw = Number(formData.get('quantity'));
  if (!Number.isFinite(raw)) {
    return;
  }
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  await prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity: clampCartQuantity(raw) } });
  revalidatePath('/koszyk');
}

/**
 * The cart page's +/- stepper — a pair of zero-JS forms bound with
 * `.bind(null, cartItemId, 1)` / `.bind(null, cartItemId, -1)`. Reads the
 * CURRENT quantity from the database rather than trusting one echoed back
 * from the client, then clamps the result — consistent with every other
 * mutation in this file never trusting a client-supplied number on its own.
 */
export async function adjustCartItemQuantity(cartItemId: string, delta: 1 | -1): Promise<void> {
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  const current = await prisma.cartItem.findUnique({ where: { id: cartItemId }, select: { quantity: true } });
  if (current === null) {
    return;
  }
  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: clampCartQuantity(current.quantity + delta) },
  });
  revalidatePath('/koszyk');
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  await prisma.cartItem.delete({ where: { id: cartItemId } });
  revalidatePath('/koszyk');
}

/** Deep-copies the `Configuration` row — a duplicate is a second independent draft, not a quantity bump. */
export async function duplicateCartItem(cartItemId: string): Promise<void> {
  const owned = await requireOwnedCartItem(cartItemId);
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
  const cartItem = await prisma.cartItem.findUniqueOrThrow({ where: { id: cartItemId } });
  await prisma.cartItem.create({
    data: { cartId: cartItem.cartId, configurationId: copy.id, quantity: cartItem.quantity },
  });
  revalidatePath('/koszyk');
}

/**
 * `Configuration` carries its own `userId`/`sessionToken` (§16.1:
 * "`Configuration`... access requires `userId` match or matching guest
 * `sessionToken`") — checked directly, not via a `CartItem` join. The
 * "Edytuj" link on the cart page encodes the `Configuration` id, not the
 * `CartItem` id, precisely so this can be verified this way.
 */
/** `null` when there's no owner or the configuration isn't this owner's own — the caller's `Owner` otherwise, so it can also verify a `customUploadId` without re-deriving it a second time. */
async function requireOwnedConfiguration(configurationId: string): Promise<Owner | null> {
  const owner = await currentOwner();
  if (hasNoOwner(owner)) {
    return null;
  }
  const configuration = await prisma.configuration.findFirst({
    where: { id: configurationId, OR: ownerOrClauses(owner) },
    select: { id: true },
  });
  return configuration === null ? null : owner;
}

export async function updateCartItemConfiguration(
  configurationId: string,
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
): Promise<AddToCartResult> {
  const owner = await requireOwnedConfiguration(configurationId);
  if (owner === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  if (!(await verifyOwnedCustomDesign(selections.customUploadId, owner))) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const validated = await priceAndValidateSelections(productSlug, selections);
  if (validated === null) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const { pricing } = validated;

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

  revalidatePath('/koszyk');
  return { ok: true };
}

'use server';

/**
 * Server Action surface for the cart — the thin half. Every real mutation
 * lives in `@/server/operations/cart`; this file only ever does the two
 * things that genuinely need a request: derive who is asking, and tell
 * Next.js what to re-render.
 *
 * `docs/ARCHITECTURE.md` §16.1 — "Every Server Action re-derives the actor
 * from the session. No id is ever trusted from the request." That is what
 * `currentOwner()` below is; nothing here accepts an owner, a user id or a
 * cart id from the caller. See `docs/AUDIT-2026-08-30.md` P0-1 for why the
 * operations half must not be exported from a `'use server'` module.
 *
 * Every mutation revalidates at LAYOUT scope, not just `/koszyk`
 * (`docs/AUDIT-2026-08-30.md` P1-5). The cart badge is rendered by
 * `StorefrontChrome` from the `(shop)`/`(marketing)` layouts, so a
 * page-scoped invalidation left it showing a stale count on every other
 * page until the client Router Cache expired on its own — the same bug that
 * was already fixed for order completion, just never carried across.
 */

import { revalidatePath } from 'next/cache';

import type { Selections } from '@/domain/configuration/steps';
import {
  applyAddToCart,
  applyAdjustCartItemQuantity,
  applyDuplicateCartItem,
  applyRemoveCartItem,
  applyUpdateCartItemConfiguration,
  applyUpdateCartItemQuantity,
} from '@/server/operations/cart';
import { ensureGuestSessionToken } from '@/server/session/guest-session';
import { currentOwner } from '@/server/session/ownership';

export type { AddToCartResult } from '@/server/operations/cart';

/** Both halves of the caller's identity, plus the guest cookie minted if this is their first mutation of the visit. */
async function actor(): Promise<{ readonly owner: Awaited<ReturnType<typeof currentOwner>>; readonly sessionToken: string }> {
  const sessionToken = await ensureGuestSessionToken();
  const owner = await currentOwner();
  return { owner, sessionToken };
}

/** Cart contents drive the header badge as well as the cart page itself. */
function revalidateCart(): void {
  revalidatePath('/koszyk');
  revalidatePath('/', 'layout');
}

export async function addToCart(
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
  quantity: number,
): Promise<import('@/server/operations/cart').AddToCartResult> {
  const { owner, sessionToken } = await actor();
  const result = await applyAddToCart(owner, sessionToken, productSlug, selections, acknowledgedWarnings, quantity);
  if (result.ok) {
    revalidateCart();
  }
  return result;
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

/**
 * `formData` as the trailing parameter — not a plain `quantity: number` —
 * so this can be bound with `.bind(null, cartItemId)` and used directly as
 * a `<form action>` on the cart page's own per-row quantity form, the same
 * zero-client-JS pattern as `CategoryFilterForm`. A non-numeric or missing
 * value is left alone; anything numeric, however large, is clamped rather
 * than trusted.
 */
export async function updateCartItemQuantity(cartItemId: string, formData: FormData): Promise<void> {
  const owner = await currentOwner();
  await applyUpdateCartItemQuantity(owner, cartItemId, Number(formData.get('quantity')));
  revalidateCart();
}

/** The cart page's +/- stepper — a pair of zero-JS forms bound with `.bind(null, cartItemId, 1)` / `.bind(null, cartItemId, -1)`. */
export async function adjustCartItemQuantity(cartItemId: string, delta: 1 | -1): Promise<void> {
  const owner = await currentOwner();
  await applyAdjustCartItemQuantity(owner, cartItemId, delta);
  revalidateCart();
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  const owner = await currentOwner();
  await applyRemoveCartItem(owner, cartItemId);
  revalidateCart();
}

export async function duplicateCartItem(cartItemId: string): Promise<void> {
  const owner = await currentOwner();
  await applyDuplicateCartItem(owner, cartItemId);
  revalidateCart();
}

export async function updateCartItemConfiguration(
  configurationId: string,
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
): Promise<import('@/server/operations/cart').AddToCartResult> {
  const owner = await currentOwner();
  const result = await applyUpdateCartItemConfiguration(owner, configurationId, productSlug, selections, acknowledgedWarnings);
  if (result.ok) {
    revalidateCart();
  }
  return result;
}

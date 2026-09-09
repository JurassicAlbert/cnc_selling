/**
 * The one removed cart line a customer can still take back - UX-11.
 *
 * `ARCHITECTURE.md` §16A.5 states the rule this follows: "optimistic updates
 * with undo ... rather than a confirmation dialog before every action", with
 * dialogs kept for what genuinely cannot be undone. A cart removal is not
 * one of those - `applyRemoveCartItem` only ever deleted the `CartItem`, and
 * the `Configuration` behind it survives as a saved project. Nothing is
 * destroyed by removing a line; there was simply no way back to it.
 *
 * **A cookie rather than client state, and that is the interesting choice.**
 * §16A.5 describes a snackbar, which is the panel's pattern and needs
 * JavaScript. The cart deliberately has none: every control on it is a plain
 * `<form action={...}>`, which is why it still works with scripting off. A
 * cookie keeps that property, and buys two things a snackbar cannot:
 *
 *   - the offer survives a reload, so a customer who removes the wrong line
 *     and reflexively refreshes still gets it back;
 *   - it survives the empty cart. Removing your only item renders a
 *     completely different branch of the page, which is exactly the removal
 *     you most want to undo.
 *
 * Thirty seconds. Long enough to notice a mistake and act, short enough that
 * the bar is gone by the next visit - and short-lived because it is an offer,
 * not a record: the `Configuration` remains reachable from „Moje projekty"
 * long after this expires.
 *
 * `HttpOnly`, and `applyRestoreCartItem` re-checks ownership anyway. A cookie
 * is something a client holds, so its contents are a claim rather than a
 * fact; naming somebody else's configuration in it gets a refusal.
 */

import { cookies, headers } from 'next/headers';

import type { RemovedCartLine } from '@/server/operations/cart';
import { isSecureRequest } from '@/server/security/headers';

export const CART_UNDO_COOKIE = 'cart-undo';

/** Scoped to the cart, the only page that offers it. */
export const CART_UNDO_COOKIE_PATH = '/koszyk';

export const CART_UNDO_SECONDS = 30;

export async function setCartUndo(line: RemovedCartLine): Promise<void> {
  const store = await cookies();
  store.set(CART_UNDO_COOKIE, JSON.stringify(line), {
    httpOnly: true,
    sameSite: 'lax',
    /*
      Decided from the request's own scheme, not from `NODE_ENV`, and that
      distinction cost a test run to find. `Secure` from `NODE_ENV` marks the
      cookie secure under `next start` on plain http - and WebKit accepts it
      into the jar but will not SEND it back, so the undo bar appeared once
      (the same response the server had just written the value into) and
      vanished on the next request. Chromium, which treats localhost as
      trustworthy, passed throughout. `proxy.ts` already reads the scheme for
      exactly this reason; this is the same rule where there is no
      `NextRequest` to read it from.
    */
    secure: isSecureRequest({ protocol: 'http:', forwardedProto: (await headers()).get('x-forwarded-proto') }),
    path: CART_UNDO_COOKIE_PATH,
    maxAge: CART_UNDO_SECONDS,
  });
}

export async function clearCartUndo(): Promise<void> {
  const store = await cookies();
  store.delete({ name: CART_UNDO_COOKIE, path: CART_UNDO_COOKIE_PATH });
}

/**
 * Parsed defensively rather than cast. The value is JSON this app wrote, but
 * it arrives from a request, and a malformed one must read as "nothing to
 * undo" rather than throw on the cart page.
 */
export async function readCartUndo(): Promise<RemovedCartLine | null> {
  const raw = (await cookies()).get(CART_UNDO_COOKIE)?.value;
  if (raw === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { configurationId, configurationSignature, quantity } = parsed as Record<string, unknown>;
    if (typeof configurationId !== 'string' || typeof configurationSignature !== 'string') {
      return null;
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return null;
    }
    return { configurationId, configurationSignature, quantity };
  } catch {
    return null;
  }
}

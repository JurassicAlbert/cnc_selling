/**
 * Read-only half of the guest session — safe to call from Server
 * Components (the cart page), which are only ever allowed to READ cookies.
 * Minting/writing a new session token only happens in a Server Action
 * (`ensureGuestSessionToken` in `src/server/actions/cart.ts`), never here —
 * `next/headers`'s `cookies().set()` is illegal outside a Server Function
 * or Route Handler.
 */

import { cookies } from 'next/headers';

import { isValidSignedSessionValue, requireSessionSecret } from './guest-session';

export const GUEST_SESSION_COOKIE_NAME = 'gsid';

/** `null` when there is no cookie, or it fails signature verification (tampered/forged). */
export async function readGuestSessionToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (value === undefined) {
    return null;
  }
  return isValidSignedSessionValue(value, requireSessionSecret()) ? value : null;
}

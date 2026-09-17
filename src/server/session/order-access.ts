/**
 * The guest order token, kept in a cookie instead of the address bar -
 * `docs/AI-CHECKLIST.md` BUG-22.
 *
 * `/zamowienie/2026-09-0042?token=abc` put the credential in the address bar,
 * in browser history, in server access logs, and in the `Referer` of anything
 * the customer clicked from that page. The owner's instruction on 2026-09-05
 * was that no token or personal information should be visible in the address.
 *
 * Two entry points reach the confirmation page, and they need different
 * treatment for a reason worth writing down:
 *
 * - **The emailed link** carries `?token=` because that is what makes it one
 *   click, which the owner kept. `src/proxy.ts` exchanges it on the way in -
 *   a real document navigation, where a middleware `Set-Cookie` works.
 * - **The checkout and lookup redirects** call this directly, so the token
 *   never enters an address at all. They must not rely on the proxy:
 *   `redirect()` from a Server Action is followed by the client router, which
 *   fetches an RSC payload rather than navigating, and a `Set-Cookie` on a
 *   middleware redirect does not reliably reach the render that follows. The
 *   first attempt did rely on it and broke guest checkout outright.
 *
 * The cookie name and options are defined here and in `proxy.ts`, which
 * cannot import this module - middleware runs in a separate bundle that must
 * not pull in `next/headers`. `tests/unit/order-access.test.ts` pins that the
 * two definitions agree, since a silent divergence would mean the emailed
 * link sets a cookie the page never reads.
 */

import { cookies, headers } from 'next/headers';

import { isSecureRequest } from '@/server/security/headers';

export const ORDER_ACCESS_COOKIE = 'order-access';

/**
 * Scoped to `/zamowienie`, so it is not sent with every request to the site -
 * a credential that travels on requests which cannot use it is a credential
 * with a wider blast radius than it needs.
 *
 * A session cookie on purpose: the durable credential stays the emailed link,
 * which re-exchanges whenever it is followed, so nothing needs to persist on
 * the device.
 */
export const ORDER_ACCESS_COOKIE_PATH = '/zamowienie';

export async function setOrderAccessCookie(token: string): Promise<void> {
  (await cookies()).set(ORDER_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    /*
      SEC-12. Decided from the request's own scheme, not from `NODE_ENV`.

      **What was here before did not do what its comment said.** The rule was
      `NODE_ENV === 'production' && process.env.E2E !== '1'`, and nothing in
      this repository has ever set `E2E` - the only mention of it was that
      expression - so the clause was never false and the exemption it
      described did not exist.

      Correct in production, where the site is https. Wrong on every other
      way a production build gets served over plain http: a staging box, a
      LAN preview, a container behind a TLS-terminating proxy, and this
      repo's own e2e suite. **WebKit accepts a `Secure` cookie over http into
      the jar and then declines to send it back**, so for a guest order token
      that is a confirmation link which works once and never again. UX-11 hit
      exactly this with the cart-undo cookie; this is the same rule on the
      credential path, and `cart-undo.ts` carries the longer account of how it
      was diagnosed.

      `protocol: 'http:'` because a Server Action has no `NextRequest` to read
      a scheme from, so `x-forwarded-proto` is the only record of what the
      browser used - the same call `cart-undo.ts` makes, deliberately
      identical so the two cookie writers cannot drift.
    */
    secure: isSecureRequest({ protocol: 'http:', forwardedProto: (await headers()).get('x-forwarded-proto') }),
    path: ORDER_ACCESS_COOKIE_PATH,
  });
}

export async function readOrderAccessCookie(): Promise<string | null> {
  const value = (await cookies()).get(ORDER_ACCESS_COOKIE)?.value;
  return value === undefined || value.length === 0 ? null : value;
}

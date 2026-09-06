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

import { cookies } from 'next/headers';

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
    // `NODE_ENV` rather than the request's scheme, unlike `proxy.ts` which has
    // a `NextRequest` to read: a `Secure` cookie is silently dropped over
    // http, which would break the e2e suite - it runs a production build on
    // plain localhost - while looking like an authorization bug. SEC-11 is the
    // same trap in a different header.
    secure: process.env.NODE_ENV === 'production' && process.env.E2E !== '1',
    path: ORDER_ACCESS_COOKIE_PATH,
  });
}

export async function readOrderAccessCookie(): Promise<string | null> {
  const value = (await cookies()).get(ORDER_ACCESS_COOKIE)?.value;
  return value === undefined || value.length === 0 ? null : value;
}

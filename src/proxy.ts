/**
 * Two jobs, both of which have to happen before a route renders:
 *
 * 1. **`/panel/*` gating, unauthenticated half only.**
 * 2. **The Content-Security-Policy**, which needs a fresh nonce per request
 *    and therefore cannot come from `next.config.ts`'s static `headers()`.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (`node_modules/next/dist/
 * docs/01-app/03-api-reference/03-file-conventions/proxy.md` - `middleware.ts`
 * is dead, not just deprecated-but-working). Proxy now defaults to the
 * Node.js runtime (v16.0.0), but the auth half still only does the cheap,
 * edge-safe check - `getSessionCookie` reads the cookie's presence, never
 * verifies it against the database. The real role check (`STAFF`/`ADMIN` vs
 * `CUSTOMER` - a real DB read) belongs in `src/app/(admin)/panel/layout.tsx`,
 * a Server Component, not here: proxy's own docs warn a matcher change can
 * silently drop coverage, so authorization must never live ONLY in proxy.
 *
 * That warning is exactly why the matcher below is split in two rather than
 * widened in place. The CSP entry skips prefetches (Next's CSP guide
 * recommends it - a prefetch returns an RSC payload, not a document), and
 * applying that same `missing:` clause to `/panel` would have quietly meant
 * a prefetched panel URL no longer hit the redirect. The `/panel` entry
 * therefore keeps matching everything, unconditionally, as it did before.
 *
 * The policy itself lives in `src/server/security/headers.ts` - pure and
 * unit-tested - because a policy string assembled inline in a proxy is a
 * policy nobody can test without booting a server.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

import {
  buildContentSecurityPolicy,
  cspHeaderName,
  generateNonce,
  isSecureRequest,
  resolveCspMode,
} from '@/server/security/headers';

export function proxy(request: NextRequest): NextResponse {
  const mode = resolveCspMode(process.env.CSP_MODE);
  const isPanel = request.nextUrl.pathname.startsWith('/panel');
  const needsRedirect = isPanel && getSessionCookie(request) === null;
  const exchange = orderTokenExchange(request);

  if (mode === 'off') {
    if (needsRedirect) {
      return redirectToLogin(request);
    }
    return exchange ?? NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    isSecure: isSecureRequest({
      protocol: request.nextUrl.protocol,
      forwardedProto: request.headers.get('x-forwarded-proto'),
    }),
  });
  const headerName = cspHeaderName(mode);

  if (needsRedirect) {
    const response = redirectToLogin(request);
    response.headers.set(headerName, csp);
    return response;
  }

  // A real response the browser acts on, so it carries the policy too - the
  // same point SEC-05's own test makes about the `/panel` redirect above.
  if (exchange !== null) {
    exchange.headers.set(headerName, csp);
    return exchange;
  }

  // On the REQUEST, so Next can read the nonce back out at render time and
  // stamp it onto its own script tags (`node_modules/next/dist/server/
  // app-render/app-render.js:209-210` reads either the enforcing or the
  // report-only header - which is what makes a report-only rollout show
  // real violations instead of a flood of false ones from the framework's
  // own scripts). `x-nonce` is the documented way for a `<Script>` component
  // to pick it up; nothing reads it yet, and a third-party script added
  // later will need it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(headerName, csp);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // And on the RESPONSE, which is the only copy the browser ever acts on.
  response.headers.set(headerName, csp);
  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/logowanie', request.url));
}

/**
 * The cookie the confirmation page reads instead of a query parameter.
 *
 * Duplicated from `server/session/order-access.ts` rather than imported:
 * middleware runs in its own bundle and must not pull in `next/headers`.
 * `tests/unit/order-access.test.ts` pins that the two agree, because a silent
 * divergence would mean the emailed link sets a cookie the page never reads -
 * a failure that looks exactly like a wrong token.
 */
const ORDER_ACCESS_COOKIE = 'order-access';
const ORDER_ACCESS_COOKIE_PATH = '/zamowienie';

/**
 * Take the guest order token out of the address - `docs/AI-CHECKLIST.md`
 * BUG-22.
 *
 * `/zamowienie/2026-09-0042?token=abc` puts the credential in the address
 * bar, in browser history, in access logs, and in the `Referer` of anything
 * the customer clicks from that page. Owner's instruction, 2026-09-05: no
 * tokens or personal information visible in the address.
 *
 * The emailed link still carries it once - that is what makes it one click,
 * and the owner kept that - so this exchanges it for an `HttpOnly` cookie and
 * redirects to the clean URL. The token appears in exactly one request
 * instead of in every address for the rest of the visit.
 *
 * **Here rather than in the page** because writing a cookie needs a response,
 * and a Server Component cannot produce one. The proxy already runs on this
 * path for the CSP.
 *
 * A session cookie, deliberately: the durable credential stays the emailed
 * link, which re-exchanges whenever it is followed. Nothing needs to persist
 * on the device.
 *
 * Returns `null` when there is nothing to do, which is almost every request -
 * including the redirected one, so this cannot loop.
 */
function orderTokenExchange(request: NextRequest): NextResponse | null {
  // Narrow on purpose. `?token=` means something specific on this path and
  // nothing anywhere else; a proxy that harvested every parameter called
  // "token" into a cookie would be a new problem rather than a fix.
  if (!request.nextUrl.pathname.startsWith('/zamowienie/')) {
    return null;
  }

  const token = request.nextUrl.searchParams.get('token');
  if (token === null || token.length === 0) {
    return null;
  }

  const clean = request.nextUrl.clone();
  // Only the token. Anything else the address carries - a campaign parameter
  // on a link from the confirmation email, say - is not ours to discard.
  clean.searchParams.delete('token');

  const response = NextResponse.redirect(clean);
  response.cookies.set(ORDER_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Same reasoning as SEC-11's `upgrade-insecure-requests`: a `Secure`
    // cookie is silently dropped over http, which would break the e2e suite
    // and any LAN preview while looking like an authorization bug.
    secure: isSecureRequest({
      protocol: request.nextUrl.protocol,
      forwardedProto: request.headers.get('x-forwarded-proto'),
    }),
    path: ORDER_ACCESS_COOKIE_PATH,
  });
  return response;
}

export const config = {
  matcher: [
    // Unconditional, including prefetches - see the header comment.
    '/panel/:path*',
    {
      // Everything else that renders a document. `_next/static` and
      // `_next/image` are hashed immutable assets and `/api` returns data,
      // not documents; all four still get the static headers from
      // `next.config.ts`, which is not matcher-scoped.
      source: '/((?!panel|api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

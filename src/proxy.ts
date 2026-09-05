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

  if (mode === 'off') {
    return needsRedirect ? redirectToLogin(request) : NextResponse.next();
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

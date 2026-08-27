/**
 * `/panel/*` gating, unauthenticated half only. Next.js 16 renamed
 * `middleware.ts` to `proxy.ts` (`node_modules/next/dist/docs/01-app/03-
 * api-reference/03-file-conventions/proxy.md` — `middleware.ts` is dead, not
 * just deprecated-but-working). Proxy now defaults to the Node.js runtime
 * (v16.0.0), but this still only does the cheap, edge-safe check —
 * `getSessionCookie` reads the cookie's presence, never verifies it against
 * the database. The real role check (`STAFF`/`ADMIN` vs `CUSTOMER` — a real
 * DB read) belongs in `src/app/(admin)/panel/layout.tsx`, a Server
 * Component, not here: proxy's own docs warn a matcher change can silently
 * drop coverage, so authorization must never live ONLY in proxy.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function proxy(request: NextRequest): NextResponse {
  const hasSessionCookie = getSessionCookie(request) !== null;
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/logowanie', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/panel/:path*',
};

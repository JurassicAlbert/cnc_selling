/**
 * Session read helpers - mirrors `server/session/guest-session.ts`'s own
 * split, but for a different underlying reason. `next/headers`'s
 * `headers()`/`cookies()` throw outside a real request scope (P4's
 * `find*`/`require*` lesson, `docs/HANDOVER.md` §9). Better Auth's own
 * `auth.api.getSession` doesn't call `next/headers` internally at all - it
 * takes a plain `Headers` object as an explicit parameter - so the actual
 * boundary here is narrower than P4's: `getSessionFromHeaders` below is a
 * genuine pure function, callable from Vitest with a hand-built `Headers`
 * carrying a `Cookie` header, no request-scope trickery needed. Only
 * `getSession` (the thin wrapper reading real request headers via
 * `next/headers`) inherits the "must be called from a request" constraint.
 */

import { cache } from 'react';
import { headers as nextHeaders } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from './auth';

export type CurrentSession = {
  readonly userId: string;
  readonly role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  readonly name: string;
  readonly email: string;
};

function toCurrentSession(result: Awaited<ReturnType<typeof auth.api.getSession>>): CurrentSession | null {
  if (result === null) {
    return null;
  }
  const { user } = result;
  return {
    userId: user.id,
    role: user.role as CurrentSession['role'],
    name: user.name,
    email: user.email,
  };
}

export async function getSessionFromHeaders(headers: Headers): Promise<CurrentSession | null> {
  const result = await auth.api.getSession({ headers });
  return toCurrentSession(result);
}

/**
 * Request-scoped memoization - `docs/REVIEW-DETAILED.md` PERF-05. A single
 * storefront render calls this at least twice (`StorefrontChrome` for the
 * account name, the page itself for ownership), and every `require*Session`
 * below delegates to it, so a panel page reached three or four calls. Each
 * one was a real Better Auth session lookup - a database read.
 *
 * `cache()` is the correct tool rather than a data cache: the value is
 * per-user and must never outlive the request that produced it, which is
 * exactly React's guarantee here. `nextHeaders()` stays *inside* the cached
 * function deliberately - it is itself request-scoped, so there is nothing to
 * pass in, and keeping the signature argument-free means the memo key is the
 * request itself.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  return getSessionFromHeaders(await nextHeaders());
});

export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (session === null) {
    throw new Error('No active session - this action requires being logged in');
  }
  return session;
}

/**
 * Gate for `/panel/*` pages and their Server Actions. `redirect()`/
 * `notFound()` both work from a Server Action, not just a Server Component
 * - Next.js recognizes the control-flow error they throw either way - so
 * this is safe to call from both the panel layout and `src/server/actions/
 * admin-*.ts`.
 *
 * A `CUSTOMER` gets `notFound()`, never a 403 - the same "don't reveal
 * existence" rule already applied to `/api/plik/[fileId]` and the owned-
 * resource lookups in `design-review.ts` (`docs/ARCHITECTURE.md` §16.2).
 */
export async function requireStaffSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (session === null) {
    redirect('/logowanie');
  }
  if (session.role === 'CUSTOMER') {
    notFound();
  }
  return session;
}

/**
 * Gate for the panel's highest-privilege screens (staff-user management,
 * `/panel/ustawienia/personel`) - everything `requireStaffSession()` does,
 * plus `notFound()` for `STAFF` too. Same "don't reveal existence" reasoning
 * for a `STAFF` here as for a `CUSTOMER` on `requireStaffSession()`.
 */
export async function requireAdminSession(): Promise<CurrentSession> {
  const session = await requireStaffSession();
  if (session.role !== 'ADMIN') {
    notFound();
  }
  return session;
}

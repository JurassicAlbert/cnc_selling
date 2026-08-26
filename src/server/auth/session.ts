/**
 * Session read helpers — mirrors `server/session/guest-session.ts`'s own
 * split, but for a different underlying reason. `next/headers`'s
 * `headers()`/`cookies()` throw outside a real request scope (P4's
 * `find*`/`require*` lesson, `docs/HANDOVER.md` §9). Better Auth's own
 * `auth.api.getSession` doesn't call `next/headers` internally at all — it
 * takes a plain `Headers` object as an explicit parameter — so the actual
 * boundary here is narrower than P4's: `getSessionFromHeaders` below is a
 * genuine pure function, callable from Vitest with a hand-built `Headers`
 * carrying a `Cookie` header, no request-scope trickery needed. Only
 * `getSession` (the thin wrapper reading real request headers via
 * `next/headers`) inherits the "must be called from a request" constraint.
 */

import { headers as nextHeaders } from 'next/headers';

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

export async function getSession(): Promise<CurrentSession | null> {
  return getSessionFromHeaders(await nextHeaders());
}

export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (session === null) {
    throw new Error('No active session — this action requires being logged in');
  }
  return session;
}

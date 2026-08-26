/**
 * The combined "who is making this request" check — P6. §16.1: "`Configuration`
 * / `UploadedFile` / `CustomerDesign`... access requires `userId` match **or**
 * matching guest `sessionToken`" — `userId` was always `null` in practice
 * until P6 (no real auth existed), so every ownership check before this was
 * `sessionToken`-only. `currentOwner()` reads both: a real Better Auth
 * session (if logged in) and the guest cookie (kept alive across login on
 * purpose — see `docs/HANDOVER.md`'s P6 section — so a file uploaded before
 * logging in stays reachable after).
 */

import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';

export type Owner = {
  readonly userId: string | null;
  readonly sessionToken: string | null;
};

export const NO_OWNER: Owner = { userId: null, sessionToken: null };

export function hasNoOwner(owner: Owner): boolean {
  return owner.userId === null && owner.sessionToken === null;
}

/** Prisma `OR` clauses matching either half of `owner` that's actually set. Empty when neither is — callers must check `hasNoOwner` first rather than querying with an empty `OR` (which Prisma treats as "match nothing", but this makes the intent explicit). */
export function ownerOrClauses(owner: Owner): Array<{ userId: string } | { sessionToken: string }> {
  const clauses: Array<{ userId: string } | { sessionToken: string }> = [];
  if (owner.userId !== null) clauses.push({ userId: owner.userId });
  if (owner.sessionToken !== null) clauses.push({ sessionToken: owner.sessionToken });
  return clauses;
}

export async function currentOwner(): Promise<Owner> {
  const [session, sessionToken] = await Promise.all([getSession(), readGuestSessionToken()]);
  return { userId: session?.userId ?? null, sessionToken };
}

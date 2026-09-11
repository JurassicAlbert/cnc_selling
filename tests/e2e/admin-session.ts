import type { Page } from '@playwright/test';

import { registerAccount } from './register';
import { prisma } from '../../src/server/db/client';

/**
 * Register an account through the real form and give it a staff role.
 *
 * **T-33.** Seven specs had their own copy of this, and the copies disagreed
 * about a fact rather than merely about style: four signed out and back in
 * afterwards, on the stated grounds that "the session's role claim is stale -
 * Better Auth read it at sign-up, before the promotion"; three did not, and
 * passed anyway. Both cannot be right.
 *
 * **They are not, and the dance was the wrong half.** Nothing in
 * `src/server/auth/auth.ts` configures Better Auth's `session.cookieCache`,
 * so `getSession` reads the session and the user row on every call, and
 * `proxy.ts`'s own header says the rest out loud: it gates only the
 * unauthenticated half of `/panel/*`, and "the real role check (`STAFF`/`ADMIN`
 * vs `CUSTOMER` - a real DB read) belongs in `(admin)/panel/layout.tsx`". The
 * role is read fresh on every panel request. `admin-bank-account`,
 * `admin-pagination` and `admin-delivery-insurance` have been demonstrating
 * that on every run.
 *
 * **So the re-login cost more than tidiness.** Four sites each spent a
 * sign-out, a navigation and a scrypt-hashed sign-in on a session refresh that
 * changes nothing - and a sign-in is not free of consequences either: it is
 * metered by `consumeLoginAttempt`, on the same shared loopback address the
 * whole suite runs from. Registrations are unaffected, since the dance never
 * created a second account.
 *
 * **The `/panel` redirect assertions those copies carried are not lost.** They
 * were incidental to the dance rather than the point of any test; a spec that
 * wants to assert where a staff sign-in lands should do it as its own named
 * step, where a reader can see it, not as a side effect of setup.
 *
 * Extracted the same way `advisory-lock.ts` was on 2026-09-11: into one
 * implementation, with the disagreement resolved by evidence rather than by
 * picking the majority.
 */
export async function registerAndPromote(
  page: Page,
  params: {
    readonly name: string;
    readonly email: string;
    readonly password: string;
    readonly role: 'STAFF' | 'ADMIN';
  },
): Promise<void> {
  await registerAccount(page, { name: params.name, email: params.email, password: params.password });
  await prisma.user.update({ where: { email: params.email }, data: { role: params.role } });
}

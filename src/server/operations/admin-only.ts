/**
 * The `ADMIN`-only assertion, for `apply*` functions whose wrapper gates on
 * `requireAdminSession()` — `docs/REVIEW-DETAILED.md` SEC-04.
 *
 * The wrapper's gate is the one a real request meets, and it stays the
 * primary control. This exists because that gate is **unreachable from a
 * test**: `requireAdminSession` reads `next/headers`, which throws outside a
 * request scope (`tests/integration/authz.test.ts`'s header records the same
 * constraint from P4). A rule enforced only somewhere no test can reach is
 * precisely the shape of SEC-03, where `domain/compatibility` was correct,
 * unit-tested, and never called on the write path.
 *
 * So the rule is asserted twice: once at the boundary, where it belongs, and
 * once here, where it can be driven. Call it as the **first statement** of
 * the `apply` — a check that runs after the write returns a refusal to a
 * caller whose bank account has already been changed.
 *
 * Returns a refusal rather than throwing, because every operation using it
 * already returns `{ ok: false, detail }` and its caller already renders
 * that. The message is deliberately plain: a `STAFF` can only ever see it if
 * the wrapper is wrong, in which case saying so is the point.
 */

import type { CurrentSession } from '@/server/auth/session';

export type AdminOnlyRefusal = { readonly ok: false; readonly detail: string };

export function refuseUnlessAdmin(actor: CurrentSession): AdminOnlyRefusal | null {
  if (actor.role === 'ADMIN') {
    return null;
  }
  return { ok: false, detail: 'Ta operacja wymaga uprawnień administratora.' };
}

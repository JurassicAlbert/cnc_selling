'use server';

/**
 * Server Action surface for `@/server/operations/admin-faq` — the thin half.
 *
 * Every export of a `'use server'` module is a public HTTP endpoint, so
 * this file exports ONLY the session-deriving wrappers. The real logic,
 * and the `apply*(actor, …)` functions integration tests call directly,
 * live in the operations module, which is a plain module and therefore
 * reachable only from server code that already authenticated the caller.
 *
 * See `docs/AUDIT-2026-08-30.md` P0-1 for the hole this closed, and
 * `tests/unit/server-action-boundary.test.ts` for the guard that keeps it
 * closed. Forwarding via `Parameters`/`ReturnType` rather than a copied
 * signature is deliberate: it cannot drift from the real one.
 */

import * as operations from '@/server/operations/admin-faq';

export type { FaqFormInput, FaqMutationResult } from '@/server/operations/admin-faq';

export async function createFaq(
  ...args: Parameters<typeof operations.createFaq>
): ReturnType<typeof operations.createFaq> {
  return operations.createFaq(...args);
}

export async function updateFaq(
  ...args: Parameters<typeof operations.updateFaq>
): ReturnType<typeof operations.updateFaq> {
  return operations.updateFaq(...args);
}

export async function setFaqActive(
  ...args: Parameters<typeof operations.setFaqActive>
): ReturnType<typeof operations.setFaqActive> {
  return operations.setFaqActive(...args);
}

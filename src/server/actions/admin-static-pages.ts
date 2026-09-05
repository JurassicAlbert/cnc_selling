'use server';

/**
 * Server Action surface for `@/server/operations/admin-static-pages` - the thin half.
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

import * as operations from '@/server/operations/admin-static-pages';

export type { StaticPageFormInput, StaticPageMutationResult } from '@/server/operations/admin-static-pages';

export async function createStaticPage(
  ...args: Parameters<typeof operations.createStaticPage>
): ReturnType<typeof operations.createStaticPage> {
  return operations.createStaticPage(...args);
}

export async function updateStaticPage(
  ...args: Parameters<typeof operations.updateStaticPage>
): ReturnType<typeof operations.updateStaticPage> {
  return operations.updateStaticPage(...args);
}

export async function setStaticPageActive(
  ...args: Parameters<typeof operations.setStaticPageActive>
): ReturnType<typeof operations.setStaticPageActive> {
  return operations.setStaticPageActive(...args);
}

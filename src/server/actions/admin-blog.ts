'use server';

/**
 * Server Action surface for `@/server/operations/admin-blog` - the thin half.
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

import * as operations from '@/server/operations/admin-blog';

export type { BlogPostFormInput, BlogPostMutationResult } from '@/server/operations/admin-blog';

export async function createBlogPost(
  ...args: Parameters<typeof operations.createBlogPost>
): ReturnType<typeof operations.createBlogPost> {
  return operations.createBlogPost(...args);
}

export async function updateBlogPost(
  ...args: Parameters<typeof operations.updateBlogPost>
): ReturnType<typeof operations.updateBlogPost> {
  return operations.updateBlogPost(...args);
}

export async function setBlogPostActive(
  ...args: Parameters<typeof operations.setBlogPostActive>
): ReturnType<typeof operations.setBlogPostActive> {
  return operations.setBlogPostActive(...args);
}

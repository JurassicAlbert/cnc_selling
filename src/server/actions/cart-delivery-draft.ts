'use server';

/**
 * Server Action surface for `@/server/operations/cart-delivery-draft` - the
 * thin half.
 *
 * Every export of a `'use server'` module is a public HTTP endpoint, so this
 * file exports ONLY the session-deriving wrapper. The real logic, and the
 * `apply*(owner, …)` function integration tests call directly, live in the
 * operations module, which is a plain module and therefore reachable only
 * from server code that already resolved who is asking.
 *
 * See `docs/AUDIT-2026-08-30.md` P0-1 for the hole this pattern closed, and
 * `tests/unit/server-action-boundary.test.ts` for the guard that keeps it
 * closed.
 */

import * as operations from '@/server/operations/cart-delivery-draft';

export type {
  CartDeliveryDraftInput,
  SaveCartDeliveryDraftResult,
} from '@/server/operations/cart-delivery-draft';

export async function saveCartDeliveryDraft(
  ...args: Parameters<typeof operations.saveCartDeliveryDraft>
): ReturnType<typeof operations.saveCartDeliveryDraft> {
  return operations.saveCartDeliveryDraft(...args);
}

'use server';

/**
 * Server Action surface for `@/server/operations/admin-payment-methods` — the thin half.
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

import * as operations from '@/server/operations/admin-payment-methods';

export type { PaymentMethodConfigFormInput, PaymentMethodConfigMutationResult } from '@/server/operations/admin-payment-methods';

export async function createPaymentMethodConfig(
  ...args: Parameters<typeof operations.createPaymentMethodConfig>
): ReturnType<typeof operations.createPaymentMethodConfig> {
  return operations.createPaymentMethodConfig(...args);
}

export async function updatePaymentMethodConfig(
  ...args: Parameters<typeof operations.updatePaymentMethodConfig>
): ReturnType<typeof operations.updatePaymentMethodConfig> {
  return operations.updatePaymentMethodConfig(...args);
}

export async function setPaymentMethodConfigActive(
  ...args: Parameters<typeof operations.setPaymentMethodConfigActive>
): ReturnType<typeof operations.setPaymentMethodConfigActive> {
  return operations.setPaymentMethodConfigActive(...args);
}

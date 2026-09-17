/**
 * Mutual exclusion around the orders that make up the production queue -
 * `docs/AI-CHECKLIST.md` T-34.
 *
 * `getProductionCapacity()` sums **every** order in `PRODUCTION_STATUSES`
 * (`CONFIRMED`, `IN_PRODUCTION`, `FINISHING`, `READY_TO_SHIP`) and takes no
 * filter, because that is its real job in the panel. Six test files create
 * orders in those statuses, and Vitest runs files in parallel against one
 * database.
 *
 * **A delta is not isolation, which is the part worth writing down.** The
 * capacity test already compared a before and an after rather than an
 * absolute total, and its comment said that was "robust to" other files. It
 * is robust to rows that were already there; it is not robust to a row
 * another file inserts **between the two reads**, which makes the delta come
 * out larger than the work this test queued. That failed twice in full runs,
 * on 2026-09-09 and again on 2026-09-11, both times passing alone
 * immediately afterwards.
 *
 * **The polarity is the opposite of the pricing lock's**, and that is why
 * `advisory-lock.ts` exists rather than a second copy of it. There, one file
 * writes the live row and most of the suite reads it, so the writer is
 * exclusive. Here, one file reads a global sum and six write rows that land
 * in it, so the **reader** is exclusive and the writers share.
 *
 * **Why not the trick `admin-dashboard.test.ts` uses.** That file dodged the
 * same problem without a lock, by pinning `now` to 2030-06-15 so no other
 * file's fixtures can land in its window - a much cheaper answer where it
 * works. It does not work here: `getProductionCapacity()` takes no date at
 * all, so there is no window to move out of anyone's way.
 */

import { LOCK_KEYS, holdsAdvisoryLock } from './advisory-lock';

/**
 * Declare that this file reads the whole production queue and cannot tolerate
 * another file writing into it mid-measurement.
 *
 * Exclusive, so every declared writer waits.
 */
export function readsProductionCapacity(): void {
  holdsAdvisoryLock(LOCK_KEYS.productionOrders, 'exclusive');
}

/**
 * Declare that this file creates orders in a production status.
 *
 * Shared: these files still run in parallel with each other, and only stand
 * aside while the capacity measurement is running. Nothing here holds the
 * pricing lock as well - checked, and worth keeping true, because two locks
 * taken in two orders is a deadlock rather than a flake.
 */
export function writesProductionOrders(): void {
  holdsAdvisoryLock(LOCK_KEYS.productionOrders, 'shared');
}

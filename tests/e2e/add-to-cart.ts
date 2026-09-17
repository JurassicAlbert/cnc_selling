import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Wait for the configurator to be ready and put the configuration in the cart.
 *
 * **T-31, and the evidence is in the specs themselves.** Sixteen specs press
 * this button. Twelve wrote their own `toBeEnabled({ timeout: 30_000 })`;
 * four left it on Playwright's 5 s default - and the two the item names as
 * having failed a full run, `accounts` and `custom-upload`, are two of those
 * four. The flake and the missing deadline are the same list.
 *
 * **Why 5 s is not enough, and a longer wait is not a hack.** The product page
 * itself renders in under 100 ms, but the button belongs to a client island
 * that has to hydrate and complete a Server Action round trip before it means
 * anything. Under four workers sharing one Next server that exceeds 5 s often
 * enough to lose a run. The deadline is a **deadline, not a cost**: a button
 * that is ready immediately returns immediately, so the only thing a longer
 * value buys is how long a genuinely broken page waits before failing - the
 * same argument `fill-reliably.ts` and `vitest.config.ts` both make in their
 * own words.
 *
 * The real repair is fewer workers per server, which CI already does with
 * `workers: 1`. This is what makes the local suite honest in the meantime.
 *
 * Extracted the way `register.ts`, `fill-reliably.ts`, `advisory-lock.ts` and
 * `admin-session.ts` were: into one implementation, so raising the number
 * later means editing one file rather than sixteen and missing four.
 */
const READY_BUDGET_MS = 30_000;

/**
 * The button itself, scoped to `main`.
 *
 * Scoped because the page also has a fixed price bar at the bottom carrying
 * the same label on a phone (RWD-01), so an unscoped locator resolves to two.
 */
export function addToCartButton(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
}

/** Wait until the island is really interactive, then click. */
export async function addToCart(page: Page): Promise<void> {
  const button = addToCartButton(page);
  await expect(button).toBeEnabled({ timeout: READY_BUDGET_MS });
  await button.click();
}

/**
 * The same, for a spec that reached the button through its own locator - a
 * second product page rendered side by side, say. Keeps the deadline in one
 * place even where the locator cannot be.
 */
export async function waitForAddToCartReady(button: Locator): Promise<void> {
  await expect(button).toBeEnabled({ timeout: READY_BUDGET_MS });
}

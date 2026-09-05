import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Typing into a field, retried until the field actually holds the value.
 *
 * Real key-by-key typing, which dispatches genuine keyboard events over time,
 * rather than `.fill()`, an instant value-set. Confirmed directly: `.fill()`
 * immediately after a fresh mount loses the race to React reasserting the
 * field's SSR'd `defaultValue`, while `pressSequentially` at the same point
 * does not, on every browser tried including `mobile-safari`.
 *
 * **Extracted 2026-09-05.** Six specs had a near-identical private copy of
 * this, all with the same 10s budget, so raising it meant editing six files
 * and the flake it guards against kept resurfacing in whichever spec had not
 * been touched yet. Three separate full-suite runs were lost to it, each in a
 * different file.
 *
 * The budget is now 30s, and that is a deliberate size rather than a bigger
 * round number. It is a **deadline, not a cost**: a field that fills on the
 * first attempt returns immediately, so a longer deadline costs nothing
 * except how long a genuinely stuck field waits before failing. What it buys
 * is that four browsers sharing one Next server - `mobile-safari` typing 45
 * characters into a React-controlled input while three other workers hammer
 * the same process - no longer reports "the machine was busy" as a test
 * failure. `vitest.config.ts` raised its own timeout for exactly this reason
 * and says so in the same words.
 *
 * The real repair is fewer workers per server, not a longer wait. CI already
 * runs `workers: 1`.
 */
const FILL_BUDGET_MS = 30_000;

export async function fillReliably(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 10 });
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: FILL_BUDGET_MS });
}

/** The same, for the specs that address a field by its label rather than by a locator. */
export async function fillFieldByLabel(page: Page, label: string, value: string): Promise<void> {
  await fillReliably(page.getByLabel(label, { exact: false }).first(), value);
}

/**
 * A checkbox, verified rather than assumed - `.check()` has the same
 * post-mount race as `.fill()`.
 */
export async function checkReliably(locator: Locator): Promise<void> {
  await expect(async () => {
    await locator.check();
    await expect(locator).toBeChecked();
  }).toPass({ timeout: FILL_BUDGET_MS });
}

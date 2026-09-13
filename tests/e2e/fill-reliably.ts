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
 * The budget is 30s, and that is a deliberate size rather than a bigger round
 * number. It is a **deadline, not a cost**: a field that fills on the first
 * attempt returns immediately, so a longer deadline costs nothing except how
 * long a genuinely stuck field waits before failing.
 *
 * The real repair is fewer workers per server, not a longer wait. CI already
 * runs `workers: 1`.
 *
 * ---
 *
 * **Why the steps below are deliberately NOT bounded, 2026-09-13.**
 *
 * T-31 left a 30 s exhaustion of this budget open and undiagnosed. It is
 * diagnosed now, and the obvious repair was measured and **made the suite
 * worse**, which is worth recording so nobody spends the day re-deriving it.
 *
 * What is actually happening. `playwright.config.ts` sets no `actionTimeout`,
 * so Playwright's default of `0` - no timeout at all - governs `click`,
 * `fill` and `pressSequentially`; and `toPass` checks its deadline **between**
 * attempts, never interrupting one in flight. So one attempt can absorb the
 * whole budget, and the failure says only „Timeout 30000ms exceeded while
 * waiting on the predicate" against the closing brace. That reads exactly
 * like a budget that is too small, which is why raising it was the standing
 * suggestion and why raising it never helped.
 *
 * Where the attempt blocks, read off a reproduction at `--workers=8`: the
 * `click`, at „waiting for element to be visible, enabled and stable", on the
 * password field of `/rejestracja` under `mobile-safari`.
 *
 * **And that field is provably stable.** Sampled 60 times in the exact
 * failing sequence - name filled, e-mail filled - it reports **one** distinct
 * bounding box, zero `layout-shift` entries, and no running animation; MUI's
 * `mui-auto-fill-cancel` is `0.01s`, one iteration, long finished. So
 * Playwright is not watching something move. Its stability check needs two
 * consecutive animation frames, and under several workers sharing one machine
 * WebKit stops delivering them. The wait is starved, not busy.
 *
 * **Which is why bounding the steps is the wrong fix.** For a starved check,
 * waiting is the correct response: the frames arrive and the click lands. A
 * per-step ceiling converts that into a failure, and then the retry needs
 * frames too. Measured on the full suite at the default worker count:
 * **0 failures unbounded, 2 with an 8 s ceiling per step, 12 with that plus a
 * 15 s `actionTimeout` in the config.** The fix made it six times worse, so
 * it is reverted rather than kept for looking like a fix.
 *
 * This is the same mechanism as UX-29 - a WebKit two-frame stability check
 * starved by worker contention - and it has the same real repair, which is
 * fewer workers per server rather than any number in this file.
 *
 * What is kept is the diagnosis: `describeFailure` below, so the next
 * occurrence says what the field held instead of only that the helper gave
 * up. That is what cost two investigations before this one.
 *
 * **A measurement worth leaving for whoever revisits the `pressSequentially`
 * choice above.** Across 14 runs on both browser projects, idle and at
 * `--workers=8`, `.fill()` immediately after `page.goto` stuck every single
 * time, and `pressSequentially` cost roughly twice as much (975-2324 ms
 * against 382-1455 ms). That is *not* the same experiment the original claim
 * rests on - Playwright waits for load before acting, so it may never reach
 * the pre-hydration moment that claim is about - so the slower,
 * provably-working call stays. It was never what spent the budget.
 */
const FILL_BUDGET_MS = 30_000;

type FillOptions = {
  /** Overridden only by `fill-reliably.spec.ts`, so its failure cases need seconds rather than half a minute. */
  readonly budgetMs?: number;
};

/**
 * What the field actually held when we gave up.
 *
 * The two sightings under T-31 each cost an investigation that could not
 * start, because „Timeout 30000ms exceeded while waiting on the predicate"
 * says only that the helper gave up. „expected 'Jan Kowalski', field held
 * 'Jan Kowals'" separates a field that dropped a keystroke from one that was
 * cleared by a re-render, and those have nothing to do with each other. It
 * also carries the underlying cause, which is what identified the blocked
 * actionability check above within one run.
 */
async function describeFailure(locator: Locator, value: string, cause: unknown): Promise<Error> {
  let held: string;
  try {
    held = JSON.stringify(await locator.inputValue({ timeout: 2_000 }));
  } catch {
    held = '<the field could not be read at all - gone, detached, or still not actionable>';
  }
  return new Error(
    `fillReliably gave up.\n  expected: ${JSON.stringify(value)}\n  field held: ${held}\n  cause: ${String(cause)}`,
  );
}

export async function fillReliably(locator: Locator, value: string, options: FillOptions = {}): Promise<void> {
  try {
    await expect(async () => {
      await locator.click();
      await locator.fill('');
      await locator.pressSequentially(value, { delay: 10 });
      await expect(locator).toHaveValue(value);
    }).toPass({ timeout: options.budgetMs ?? FILL_BUDGET_MS });
  } catch (cause) {
    throw await describeFailure(locator, value, cause);
  }
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

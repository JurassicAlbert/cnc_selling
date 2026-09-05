import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fillReliably } from './fill-reliably';
import { clearLoopbackRateLimits } from './rate-limit-reset';

/**
 * Register a fresh account through the real form and wait for the landing.
 *
 * **Extracted 2026-09-05**, from seven near-identical private copies. Two of
 * them had already been given a longer deadline after the flake below was
 * diagnosed, and five had not, so a full run kept failing in whichever file
 * was still on the default. That is the same shape of problem, and the same
 * remedy, as `fill-reliably.ts` records for its own six copies.
 *
 * Registering is the single thing no other setup path can do for the specs
 * that need a signed-in user, so this runs a lot: promoting an account to
 * STAFF/ADMIN, exercising order history, prefilling checkout, reviewing a
 * customer design.
 *
 * Two separate hazards, both of which look identical from the outside - the
 * form simply stays on `/rejestracja` with nothing on the page to say why:
 *
 * 1. **The rate limit.** SEC-01's `registerPerIp` allows ten per day and the
 *    whole suite shares one loopback address, so the counter is cleared
 *    immediately before the submit rather than once per test. See
 *    `rate-limit-reset.ts` for why per-test is not close enough: the counter
 *    is shared across workers, so several tests can each register after the
 *    same clear and blow through the allowance together. Clearing here
 *    shrinks the window to the milliseconds before the click.
 *
 * 2. **The submit still being in flight.** Sign-up hashes a password with
 *    scrypt, writes the account, and merges the guest cart, all before it
 *    redirects. Four parallel workers hashing at once on one machine takes
 *    longer than Playwright's 5s default for `toHaveURL`, and the failure
 *    reads as if the registration was rejected. It was not: the captured
 *    snapshot of both 2026-09-05 failures shows all three fields correctly
 *    filled and the submit button still `[disabled]`, which is the pending
 *    state, with no error message anywhere on the page. The two tests had
 *    clicked 143ms apart.
 *
 * The budget is a deadline, not a cost, exactly as in `fill-reliably.ts`: a
 * registration that lands immediately returns immediately, and all a longer
 * deadline changes is how long a genuinely broken one waits before failing.
 * The real repair is fewer workers per server, and CI already runs
 * `workers: 1`.
 */
const REGISTER_BUDGET_MS = 30_000;

export async function registerAccount(
  page: Page,
  params: { readonly name: string; readonly email: string; readonly password: string },
): Promise<void> {
  await clearLoopbackRateLimits();

  await page.goto('/rejestracja');
  await fillReliably(page.getByLabel('Imię i nazwisko'), params.name);
  await fillReliably(page.getByLabel('Adres e-mail'), params.email);
  await fillReliably(page.getByLabel('Hasło'), params.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();

  await expect(page).toHaveURL('/moje-konto', { timeout: REGISTER_BUDGET_MS });
}

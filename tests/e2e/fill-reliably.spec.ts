import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { fillReliably } from './fill-reliably';

/**
 * `docs/AI-CHECKLIST.md` T-31's leftover: `fillReliably` exhausting a **30 s**
 * budget, seen 2026-09-10 in `admin-authz.spec.ts` and 2026-09-11 in
 * `accounts.spec.ts`, both times passing 4/4 alone immediately afterwards,
 * and left explicitly undiagnosed because a 30 s exhaustion is not the 5 s
 * deadline that item fixed and "make the number bigger" is not a diagnosis.
 *
 * It is diagnosed now, and `fill-reliably.ts` carries the whole finding: a
 * starved WebKit stability check, not a field that will not fill. **The thing
 * that made it diagnosable is the failure message**, and that is what these
 * tests keep true.
 *
 * Both sightings cost an investigation that could not start, because „Timeout
 * 30000ms exceeded while waiting on the predicate" says only that the helper
 * gave up - not what the field held, and not which step blocked. With those
 * two facts the third sighting took one run to explain.
 *
 * `page.setContent` rather than any page of the application, because the bug
 * was never in a page.
 */

/** An input that refuses to keep what it is given, the way a stuck field behaves. */
const REJECTING_INPUT = `
  <label for="f">Pole</label>
  <input id="f" />
  <script>
    const f = document.getElementById('f');
    f.addEventListener('input', () => { f.value = 'nie to'; });
  </script>
`;

test('the failure says what the field actually held', async ({ page }) => {
  await page.setContent(REJECTING_INPUT);

  const error = await fillReliably(page.locator('#f'), 'oczekiwana wartość', { budgetMs: 4_000 }).catch(
    (thrown: unknown) => thrown,
  );

  // „nie to" is the distinction that matters: a field that took the text and
  // was overwritten is a different bug from one that never took it, and the
  // old message could not tell them apart.
  expect(String(error)).toContain('nie to');
  expect(String(error)).toContain('oczekiwana wartość');
});

test('the failure carries the underlying cause, not just the timeout', async ({ page }) => {
  await page.setContent(REJECTING_INPUT);

  /*
    The half that identified the real mechanism. The wrapper's own timeout
    says nothing about which of `click`, `fill`, `pressSequentially` or the
    assertion was the one that blocked - and it was the `click`, waiting on an
    actionability check that never completed. Losing the cause would put the
    next occurrence back where the first two were.
  */
  const error = await fillReliably(page.locator('#f'), 'oczekiwana wartość', { budgetMs: 4_000 }).catch(
    (thrown: unknown) => thrown,
  );

  expect(String(error)).toContain('cause:');
});

test('the ordinary case is untouched and still lands the value', async ({ page }) => {
  // A guard against fixing the failure path by breaking the one that matters:
  // every spec in this suite depends on this working.
  await page.setContent('<label for="g">Pole</label><input id="g" />');

  await fillReliably(page.locator('#g'), 'Jan Kowalski');

  await expect(page.locator('#g')).toHaveValue('Jan Kowalski');
});

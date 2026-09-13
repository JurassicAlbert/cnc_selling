import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-04 / BUG-10, which asked for exactly one thing:
 * „close it when someone re-reads the mobile chrome end to end."
 *
 * The re-read found this. At 375 px the burger's **top-level** links are
 * 44 px tall, because `theme-vars.css` sets `min-height: 44px` on `.nav-link`
 * inside the open panel and says why in the same breath - „44px is the
 * minimum comfortable touch target, not a design flourish". The links inside
 * the two sub-dropdowns are `.nav-dropdown-item`, which that rule never
 * mentioned, and they came out at **38 px**.
 *
 * Eleven of them: every category and every collection. On a phone those are
 * the deepest links in the menu and the ones a thumb reaches for after two
 * taps, and they were the smallest thing in it.
 *
 * **Not a WCAG failure, and worth being accurate about that.** 2.5.8 (AA)
 * asks for 24x24 and 38 px clears it comfortably, which is why
 * `accessibility.spec.ts` never complained. This is the project's own
 * standard, applied in one place and not the other - the kind of gap that
 * only shows up when somebody opens the menu on a phone and taps to the
 * bottom of it.
 *
 * Asserted on **everything tappable in the open panel**, sub-dropdowns
 * expanded, rather than on the eleven that were wrong: the point is that one
 * rule covers the panel, not that eleven specific rows were patched.
 */
const BURGER = 'label[for="nav-burger-toggle"]';

/** The project's own figure, from `theme-vars.css`. */
const COMFORTABLE_TAP_TARGET_PX = 44;

test('every link in the open burger is a comfortable tap target', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  const burger = page.locator(BURGER);
  await expect(burger).toBeVisible();
  await burger.click();

  const panel = page.locator('.nav-burger-panel');
  await expect(panel).toBeVisible();

  /*
    The sub-dropdowns are `<details>` and start closed, so their links have no
    box until they are opened. Opened through the DOM rather than by clicking
    each `summary`: a click on one is a real tap that can scroll the panel,
    and this test is about sizes, not about the disclosure behaviour that
    `nav-blog-faq.spec.ts` already covers.
  */
  await panel.locator('details').evaluateAll((nodes) => {
    for (const node of nodes) (node as HTMLDetailsElement).open = true;
  });

  const undersized = await panel.evaluate((root, minimum) => {
    const tappable = [...root.querySelectorAll('a, summary')];
    return tappable
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { label: (element.textContent ?? '').trim().slice(0, 28), height: Math.round(box.height) };
      })
      // A zero box is an element that is genuinely not rendered; only things
      // a thumb can actually land on are in scope.
      .filter((entry) => entry.height > 0 && entry.height < minimum);
  }, COMFORTABLE_TAP_TARGET_PX);

  expect(
    undersized,
    `smaller than the ${COMFORTABLE_TAP_TARGET_PX}px this stylesheet sets for the panel: ${undersized
      .map((entry) => `${entry.label} (${entry.height}px)`)
      .join(', ')}`,
  ).toEqual([]);
});

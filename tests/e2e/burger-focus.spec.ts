import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-30, found while closing RWD-04.
 *
 * The burger is a checkbox and a label, the zero-JS disclosure pattern the
 * storefront chrome uses everywhere. The checkbox is deliberately kept
 * **off-screen rather than `display: none`** so it stays keyboard-focusable
 * and the label has something to draw a focus ring from - correct below
 * 900 px, where the label is the visible control.
 *
 * Above 900 px the label is `display: none` and the panel is a plain row, so
 * the checkbox became a focus stop with nothing attached: a keyboard user
 * tabbing through a 1280 px-wide page landed on a control announced as
 * „Menu" whose label and panel are both invisible, and pressing space did
 * nothing they could see. RWD-04's own search toggle avoids this by being
 * `display: none` above the breakpoint; the burger predates that.
 *
 * Asserted as **"can this actually take focus"** rather than on a CSS
 * property, because that is the thing a keyboard user experiences and it is
 * true or false regardless of how the rule is written: a `display: none`
 * element refuses focus, so `document.activeElement` never becomes it.
 */
const BURGER_CHECKBOX = '#nav-burger-toggle';

async function canTakeFocus(page: import('@playwright/test').Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!(element instanceof HTMLElement)) return false;
    element.focus();
    return document.activeElement === element;
  }, selector);
}

test('the burger is not a phantom tab stop on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  // The visible control really is gone at this width - otherwise this test
  // would pass for the wrong reason.
  await expect(page.locator('label[for="nav-burger-toggle"]')).toBeHidden();

  expect(await canTakeFocus(page, BURGER_CHECKBOX)).toBe(false);
});

test('the burger is still reachable by keyboard on a phone', async ({ page }) => {
  /*
    The other half, and the reason the fix is a breakpoint rather than simply
    hiding the checkbox: below 900 px this IS the control. Take the focus
    away here and the burger becomes mouse-only, which would be a worse
    accessibility bug than the one being fixed.
  */
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  await expect(page.locator('label[for="nav-burger-toggle"]')).toBeVisible();
  expect(await canTakeFocus(page, BURGER_CHECKBOX)).toBe(true);
});

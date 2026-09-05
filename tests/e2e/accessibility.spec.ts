import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` BUG-27, BUG-28, BUG-29, BUG-30 - the sitewide
 * accessibility items, driven in a real browser because every one of them is
 * about what a screen reader or a keyboard actually receives, and none of it
 * is visible in the source.
 *
 * Playwright's `getByRole` computes accessible names the way a browser does,
 * so an assertion here fails for the same reason a screen reader would go
 * quiet. That is the whole point of testing these in a browser rather than by
 * grepping for `aria-label`: a name can be present in the markup and still not
 * reach the tree, which is exactly what BUG-27 turned out to be.
 *
 * Runs on both browser projects, so the mobile layout - where the header
 * collapses behind a burger and the nav links move into a panel - is covered
 * by the same assertions as the desktop one.
 */

/**
 * Scoped to `main`, because the configurator renders a second „Dodaj do
 * koszyka" in its sticky price bar - an unscoped `getByRole` picks between
 * them arbitrarily, which is why the first version of the cart test clicked
 * and then waited for a navigation that never came. Same shape as
 * `accounts.spec.ts`'s own helper.
 */
async function addSampleConfigurationToCart(page: Page): Promise<void> {
  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const main = page.getByRole('main');
  const addToCart = main.getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 20_000 });
  await addToCart.click();
  await expect(page).toHaveURL('/koszyk', { timeout: 15_000 });
}

test.describe('sitewide accessibility', () => {
  test('a keyboard reaches the content without walking the whole menu', async ({ page }) => {
    await page.goto('/');

    /*
      BUG-28. Deliberately NOT `keyboard.press('Tab')`, which is what this
      test did first and why it failed on `mobile-safari` while passing on
      Chromium: WebKit leaves links out of the default tab order unless the
      user turns on "Press Tab to highlight each item on a webpage". The skip
      link was correct; the test was measuring a browser preference.

      So the two things that are actually true of a working skip link are
      asserted directly - it comes before everything else focusable, and it
      moves focus rather than merely scrolling.
    */
    const firstFocusable = await page.evaluate(() => {
      const focusable = Array.from(
        document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"])'),
      );
      return focusable[0]?.outerHTML.slice(0, 80) ?? null;
    });
    expect(firstFocusable).toContain('skip-link');

    const skip = page.locator('.skip-link');
    await skip.focus();

    /*
      Focused, it must be on screen. A skip link that stays off the top edge
      while focused is reachable and invisible - the sighted-keyboard user
      tabs into nothing and has no idea where they are. Asserted as a real
      position rather than by reading CSS, because the whole class of bug is
      a rule that exists and does not apply.
    */
    const top = await skip.evaluate((el) => el.getBoundingClientRect().top);
    expect(top, 'the focused skip link must be inside the viewport').toBeGreaterThanOrEqual(0);

    await skip.press('Enter');

    // Focus, not just the scroll position. A skip link that scrolls and
    // leaves focus behind in the header is the quiet way they fail, and it
    // is why `<main>` carries `tabIndex={-1}`.
    await expect(page.locator('#tresc')).toBeFocused();
  });

  test('the cart tells a screen reader how many items are in it', async ({ page }) => {
    // Configuring a product and adding it to the cart is a real journey, and
    // on `mobile-safari` it does not fit the 30s default.
    test.slow();

    // BUG-27. The count lived in a `aria-hidden="true"` badge, so the link
    // announced „Koszyk 709,16 zł" and a blind customer had no way to know
    // whether it held one item or nine.
    await addSampleConfigurationToCart(page);

    // The accessible name, not the visible text: the badge is styled as a
    // small circle, and what matters is what the name computation produces.
    await expect(page.getByRole('link', { name: /Koszyk.*1 (produkt|przedmiot)/i })).toBeVisible();
  });

  test('every navigation landmark says which one it is', async ({ page }) => {
    // BUG-29. Three `nav` landmarks on a storefront page, and the main one had
    // no name - so a screen reader's landmark list read "navigation,
    // navigation, Kategorie", and the way past the header was the unlabelled
    // one.
    await page.goto('/');

    const navs = page.getByRole('navigation');
    const count = await navs.count();
    expect(count).toBeGreaterThan(1);

    for (let index = 0; index < count; index += 1) {
      await expect(navs.nth(index)).toHaveAttribute('aria-label', /\S/);
    }
  });

  test('nothing interactive is left without an accessible name', async ({ page }) => {
    // Configure, add to cart, then walk four pages: the same shape as every
    // other journey in this suite that outgrew the 30s default.
    test.slow();

    /*
      The general form of BUG-27, so the next unnamed icon button fails here
      rather than in someone's screen reader - across the pages a customer
      actually walks through.

      The cart is filled first, and that is not incidental. `/koszyk/zamowienie`
      redirects to `/koszyk` when the cart is empty, and that pending redirect
      interrupted the next `goto` ("Navigation to /produkt/... is interrupted
      by another navigation to /koszyk"). Walking the real journey both fixes
      the race and tests the pages in the state a customer is actually in -
      checkout with nothing in the cart is a page nobody sees.
    */
    await addSampleConfigurationToCart(page);

    for (const path of ['/', '/koszyk', '/koszyk/zamowienie']) {
      await page.goto(path);
      await expect(page.locator('#tresc')).toBeVisible();

      const unnamed = await page.evaluate(() => {
        const visible = (el: Element): boolean => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const nameOf = (el: Element): string => {
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy !== null) {
            const text = labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? '')
              .join(' ')
              .trim();
            if (text.length > 0) return text;
          }
          const label = (el.getAttribute('aria-label') ?? '').trim();
          if (label.length > 0) return label;
          const labels = (el as HTMLInputElement).labels;
          if (labels !== null && labels !== undefined && labels.length > 0) {
            const text = Array.from(labels)
              .map((one) => one.textContent ?? '')
              .join(' ')
              .trim();
            if (text.length > 0) return text;
          }
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text.length > 0) return text;
          return (el.querySelector('img[alt]')?.getAttribute('alt') ?? '').trim();
        };

        return Array.from(
          document.querySelectorAll('a[href],button,input,select,textarea,summary,[role="button"]'),
        )
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .filter(visible)
          .filter((el) => nameOf(el).length === 0)
          .map((el) => el.outerHTML.slice(0, 120));
      });

      expect(unnamed, `unnamed interactive elements on ${path}`).toEqual([]);
    }
  });

  test('no undersized tap target sits close enough to another to be mis-hit', async ({ page }) => {
    test.slow();

    /*
      WCAG 2.5.8 as it is actually written, which is not what UX-04's note
      assumed. 24x24 CSS px is the rule, but an undersized target passes when
      a 24px circle centred on it does not reach another target's circle -
      and measured on 2026-09-05, every undersized target on this site is
      spaced that far apart. So what is pinned is the real requirement rather
      than a bare height, which would fail on a footer link that is perfectly
      usable.
    */
    await addSampleConfigurationToCart(page);

    for (const path of ['/', '/koszyk', '/koszyk/zamowienie']) {
      await page.goto(path);
      await expect(page.locator('#tresc')).toBeVisible();

      const crowded = await page.evaluate(() => {
        const visible = (el: Element): boolean => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        /*
          A `<label for>` and the field it labels are one target, not two:
          clicking either does the same thing. Counting them separately made
          this report every floating MUI label on the checkout form as
          "crowding" the input directly beneath it - three false positives on
          `mobile-safari`, and the reason this filter exists rather than the
          simpler selector it started as.
        */
        const elements = Array.from(
          document.querySelectorAll('a[href],button,input,select,textarea,summary,label[for],[role="button"]'),
        )
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .filter(visible);

        const labelled = new Set(
          elements.flatMap((el) => {
            const control = (el as HTMLLabelElement).control;
            return control !== null && control !== undefined ? [control as Element] : [];
          }),
        );

        const targets = elements
          .filter((el) => !(el.tagName === 'LABEL' && labelled.has((el as HTMLLabelElement).control as Element)))
          .map((el) => ({ rect: el.getBoundingClientRect(), html: el.outerHTML.slice(0, 90) }));

        const centre = (r: DOMRect): readonly [number, number] => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];

        return targets
          .filter(({ rect }) => rect.width < 24 || rect.height < 24)
          .filter((one) =>
            targets.some((other) => {
              if (other === one) return false;
              const [ax, ay] = centre(one.rect);
              const [bx, by] = centre(other.rect);
              return Math.hypot(ax - bx, ay - by) < 24;
            }),
          )
          .map((one) => one.html);
      });

      expect(crowded, `undersized targets crowding a neighbour on ${path}`).toEqual([]);
    }
  });
});

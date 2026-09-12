import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { addToCart } from './add-to-cart';

/**
 * `docs/AI-CHECKLIST.md` UX-29, measured 2026-09-12 and closed as **not a
 * product defect**.
 *
 * The item's symptom was real: clicking „Przejdź do zamówienia" timed out on
 * mobile-safari under full-suite load, with the link resolved but never
 * "stable". Playwright refuses to click an element whose bounding box differs
 * between two consecutive animation frames, so the reading was that something
 * on the cart page re-lays out continuously. It named three candidates - an
 * image without reserved dimensions, the consent banner, or a re-render loop.
 *
 * **All three are ruled out, on WebKit, with a real cart**, which is what this
 * spec now keeps true:
 *
 * - the link's box is **identical across 40 samples** over about two seconds;
 * - `PerformanceObserver` records **zero** `layout-shift` entries;
 * - nothing is animating the link or anything it sits inside;
 * - and the one image in the cart has reserved dimensions, so nothing reflows
 *   when it decodes. (A fourth candidate, a global `transition: all` visible
 *   on `body`/`main`/`section`, was checked and is the CSS initial value -
 *   `transition-duration` is `0s`, so nothing animates.)
 *
 * What is left is contention, not layout: four workers share one Next server,
 * and under WebKit the frame budget starves long enough that a two-frame
 * stability check can miss its window. That is the same root cause as T-31 and
 * the `fillReliably` flake, and CI already runs `workers: 1`.
 *
 * **The animation check is scoped to the link's own ancestor chain, and the
 * first draft was not.** Asserting "nothing on the page is animating" failed
 * on desktop-chromium against `orbit-spin`/`orbit-counter-spin` - the footer's
 * decorative `OrbitIconHero`, which is deliberate, respects
 * `prefers-reduced-motion`, and has nothing to do with whether a link in the
 * cart can be clicked. A test that fails for a true-but-irrelevant reason
 * teaches people to ignore it.
 *
 * Kept as a guard rather than deleted with the diagnosis: the page being
 * stable is now a property somebody could break with one shimmer or one
 * unsized image, and this is the only thing that would notice.
 */
test('the cart page settles, so its checkout link can actually be clicked', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  await addToCart(page);
  await expect(page).toHaveURL('/koszyk');

  const checkout = page.getByRole('link', { name: 'Przejdź do zamówienia' });
  await expect(checkout).toBeVisible({ timeout: 30_000 });

  const measured = await page.evaluate(async () => {
    const shifts: { value: number; at: number; sources: string[] }[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value: number; sources?: { node?: Node }[] };
        shifts.push({
          value: Number(e.value.toFixed(4)),
          at: Math.round(e.startTime),
          // Naming the element is the whole point of a failure here: "one
          // shift" sends someone hunting, "the consent banner shifted" does
          // not.
          sources: (e.sources ?? []).map((s) => {
            const n = s.node as Element | undefined;
            return n ? `${n.tagName}.${String(n.className ?? '').split(' ')[0]}`.slice(0, 48) : 'unknown';
          }),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });

    const link = [...document.querySelectorAll('a')].find((a) => a.textContent?.includes('Przejdź do zamówienia'));
    if (link === undefined) return { boxes: ['link disappeared'], animations: ['n/a'], shifts };

    const boxes = new Set<string>();
    const animations = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const r = link.getBoundingClientRect();
      boxes.add(`${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`);
      for (const a of document.getAnimations()) {
        // Only what could actually move THIS link: an animation on it, or on
        // something it sits inside. The footer's decorative orbit is neither.
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        if (target !== null && target !== undefined && target.contains(link)) {
          animations.add(String((a as Animation & { animationName?: string }).animationName ?? 'transition'));
        }
      }
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 40)));
    }
    return { boxes: [...boxes], animations: [...animations], shifts };
  });

  // One box, sampled 40 times across roughly two seconds.
  expect(measured.boxes, `the checkout link moved: ${measured.boxes.join(' | ')}`).toHaveLength(1);
  expect(measured.animations, `something is animating: ${measured.animations.join(', ')}`).toHaveLength(0);
  expect(measured.shifts, `the cart page shifted: ${JSON.stringify(measured.shifts)}`).toHaveLength(0);

  // And the consequence the item was actually about: it can be clicked.
  await checkout.click();
  await expect(page).toHaveURL('/koszyk/zamowienie');
});

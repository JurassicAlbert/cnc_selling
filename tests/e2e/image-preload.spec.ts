import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` PERF-06.
 *
 * `priority` on `next/image` is deprecated in Next 16 in favour of `preload`.
 * The item calls it a mechanical rename, and **that was checked against the
 * source rather than the prose** (`shared/lib/get-img-props.js`, 16.3.2):
 *
 * - `isLazy = !priority && !preload && …` - `preload` suppresses lazy exactly
 *   as `priority` did.
 * - `preload: preload || priority` - either emits the `<link>`.
 * - `fetchPriority` is passed straight through; **neither prop sets it**, so
 *   nothing is lost by the rename. The docs' advice to "use `fetchPriority`
 *   instead in most cases" is about a different choice, not about this one.
 *
 * This spec is a **guard, not a red test**: it passes before the rename and
 * after, and that is the point. The risk in renaming a prop that controls
 * loading is silently making the hero lazy, or making everything eager, and
 * neither shows up in a screenshot.
 */
test('the above-the-fold images are preloaded and the rest are not', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  const state = await page.evaluate(() => {
    const preloadHrefs = [...document.querySelectorAll('link[rel="preload"][as="image"]')].map(
      (link) => (link as HTMLLinkElement).getAttribute('imagesrcset') ?? (link as HTMLLinkElement).href,
    );
    const images = [...document.querySelectorAll('img')].map((img) => ({
      alt: img.getAttribute('alt') ?? '',
      loading: img.getAttribute('loading'),
      top: Math.round(img.getBoundingClientRect().top),
    }));
    return { preloadCount: preloadHrefs.length, images };
  });

  // Something is preloaded at all - the wordmark already used `preload`
  // before this item, so a zero here means the mechanism itself broke.
  expect(state.preloadCount).toBeGreaterThan(0);

  /*
    The eager set is small and deliberate. `priority`/`preload` marks the
    handful of images that can be the LCP element; if a rename turned the
    whole page eager, this is where it shows.
  */
  const eager = state.images.filter((img) => img.loading !== 'lazy');
  const lazy = state.images.filter((img) => img.loading === 'lazy');
  expect(eager.length).toBeGreaterThan(0);
  expect(lazy.length).toBeGreaterThan(0);
  expect(eager.length).toBeLessThan(lazy.length);

  // And nothing eager is far down the page - that would be a preload paying
  // for something nobody has scrolled to.
  const viewportHeight = page.viewportSize()?.height ?? 0;
  for (const img of eager) {
    expect(img.top, `an eager image sits ${img.top}px down the page`).toBeLessThan(viewportHeight * 2);
  }
});

/**
 * PERF-07. The homepage's largest-contentful-paint element is the hero's
 * first frame, and it used to be the `<video>`'s own `poster` attribute -
 * which `next/image` cannot preload, so the browser only learned the URL
 * after parsing the SVG, the `foreignObject` and the video. The element that
 * decides the score was the one discovered last.
 *
 * Two things are pinned here, and the second matters as much as the first:
 * the frame is preloaded, **and the video no longer carries a `poster`**.
 * Putting the attribute back would fetch the same frame twice under two URLs,
 * because the optimiser serves `/_next/image?url=…` rather than the file path,
 * and nothing on screen would look wrong.
 */
test('the hero first frame is preloaded, and fetched only once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  const state = await page.evaluate(() => {
    const preloaded = [...document.querySelectorAll('link[rel="preload"][as="image"]')]
      .map((link) => (link as HTMLLinkElement).getAttribute('imagesrcset') ?? (link as HTMLLinkElement).href)
      .join(' ');
    const video = document.querySelector('foreignObject video');
    const image = document.querySelector('foreignObject img');
    return {
      posterIsPreloaded: preloaded.includes('hero-carving-poster'),
      videoHasPoster: video?.hasAttribute('poster') ?? null,
      heroImageIsOptimised: (image?.getAttribute('src') ?? '').includes('/_next/image'),
    };
  });

  expect(state.posterIsPreloaded).toBe(true);
  expect(state.videoHasPoster).toBe(false);
  expect(state.heroImageIsOptimised).toBe(true);
});

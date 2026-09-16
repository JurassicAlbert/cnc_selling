import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * A page that does not exist must not be indexable.
 *
 * **Found 2026-09-16, and it predates the work that found it.** Measured on a
 * production build, every missing URL on the storefront answers **200**:
 * `/produkt/nie-ma-takiego`, `/nie-ma-kategorii`, `/blog/nie-ma-wpisu`,
 * `/kolekcje/nie-ma`, `/strony/nie-ma` - all of them.
 *
 * That is documented Next behaviour rather than a defect in it. Every route
 * group has a `loading.tsx`, which wraps its segment in a `<Suspense>`
 * boundary, and the `not-found` reference states the consequence plainly:
 * "Next.js will return a `200` HTTP status code for streamed responses, and
 * `404` for non-streamed responses". The status is flushed before the page's
 * own lookup reaches `notFound()`, and it cannot be changed afterwards.
 *
 * **Why it matters**: a 200 carrying "page not found" is a soft 404, and a
 * search engine treats it as a real page. With a catalogue of dynamic routes
 * (`/produkt/[slug]`, `/[category]`, `/kolekcje/[slug]`) that is an unbounded
 * supply of indexable near-duplicate pages, all of them thin, all of them
 * saying the same thing - the classic way for a small shop's ranking to be
 * diluted by its own 404s.
 *
 * **The fix is the one the framework's own docs name**: `noindex`. Getting a
 * real 404 back would mean checking existence before the response streams -
 * in `proxy.ts` - which would put a database read in front of every request
 * on the site to correct a status code. The `robots` tag solves the part that
 * actually causes harm.
 *
 * Asserted on the served HTML rather than on a `metadata` export, because
 * what a crawler reads is the tag, and a metadata object that fails to reach
 * the document would pass a unit test and change nothing.
 */
const MISSING = [
  '/produkt/nie-ma-takiego-produktu',
  '/nie-ma-takiej-kategorii',
  '/blog/nie-ma-takiego-wpisu',
  '/kolekcje/nie-ma-takiej-kolekcji',
];

test('a page that does not exist tells crawlers not to index it', async ({ page }) => {
  test.slow();

  for (const path of MISSING) {
    await page.goto(path);

    // The visitor still gets the not-found page - this is about the tag, not
    // about changing what anybody sees.
    const robots = page.locator('meta[name="robots"]');
    await expect(robots, `${path} has no robots meta tag`).toHaveCount(1);
    await expect(robots, `${path} is indexable`).toHaveAttribute('content', /noindex/);
  }
});

test('a real page stays indexable', async ({ page }) => {
  /*
    The other half, and the reason this is two tests. A `noindex` applied too
    broadly - on a shared layout, say - would pass the test above and quietly
    remove the entire shop from search results, which is a far worse outcome
    than the soft 404 being fixed.
  */
  await page.goto('/produkt/obraz-drewniany-z-grawerem');

  const robots = page.locator('meta[name="robots"]');
  const count = await robots.count();
  if (count > 0) {
    await expect(robots).not.toHaveAttribute('content', /noindex/);
  }
});

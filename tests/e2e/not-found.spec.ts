import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-06 and BUG-33 - what a visitor sees, and what a
 * crawler sees, when a URL does not resolve.
 *
 * Six routes, each of which can miss for an ordinary reason: a retired
 * category, a product that sold out and was unpublished, a draft blog post
 * shared too early, a collection link from an old newsletter, a CMS page
 * whose slug changed, and an order confirmation opened without the cookie
 * that authorises it.
 *
 * **Three things are pinned per route, and each of them was wrong before.**
 *
 * 1. **A specific heading.** „Nie znaleziono takiej strony" on
 *    `/produkt/...` is not false, but it points at the wrong thing: the page
 *    exists, the product does not, and a visitor who is told the address is
 *    dead stops looking for the item.
 * 2. **A way out.** Three of these routes rendered a heading and the literal
 *    „404" with no links at all.
 * 3. **A real `<title>`.** Every `generateMetadata` here returned `{}` for a
 *    missing resource, so the tab read „RYT" - the root layout's fallback -
 *    and a browser history full of dead ends was indistinguishable from a
 *    history full of the home page. The order route was worse than useless:
 *    its static metadata said „Zamówienie przyjęte" whether or not an order
 *    had been found, so a wrong link produced a tab announcing a confirmed
 *    order that does not exist.
 *
 * **`noindex` is asserted, not assumed, and that is the point of BUG-33.**
 * Every route below answers HTTP 200 rather than 404, because the response is
 * already streaming by the time `notFound()` throws - documented Next.js
 * behaviour (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-
 * conventions/loading.md`, "Status Codes"), not a defect here. What keeps
 * that from becoming an indexable duplicate of the not-found page is the
 * `<meta name="robots" content="noindex">` the framework injects instead. So
 * the whole SEO argument rests on a tag this project does not write, which is
 * exactly the kind of borrowed guarantee worth a test of its own: if a
 * framework upgrade stops injecting it, this fails here rather than quietly
 * in Search Console months later.
 */

type NotFoundCase = {
  readonly what: string;
  readonly path: string;
  readonly headingPl: string;
};

const CASES: readonly NotFoundCase[] = [
  {
    what: 'a category that does not exist',
    path: '/nie-ma-takiej-kategorii',
    headingPl: 'Nie znaleziono takiej kategorii',
  },
  {
    what: 'a product that does not exist',
    path: '/produkt/nie-ma-takiego-produktu',
    headingPl: 'Nie znaleziono takiego produktu',
  },
  {
    what: 'a blog post that does not exist',
    path: '/blog/nie-ma-takiego-wpisu',
    headingPl: 'Nie znaleziono takiego wpisu',
  },
  {
    what: 'a collection that does not exist',
    path: '/kolekcje/nie-ma-takiej-kolekcji',
    headingPl: 'Nie znaleziono takiej kolekcji',
  },
  {
    what: 'a CMS page that does not exist',
    path: '/strony/nie-ma-takiej-podstrony',
    headingPl: 'Nie znaleziono takiej strony',
  },
  {
    /*
      No cookie at all, which is what a link opened in another browser looks
      like. §16.1's "404, not 403" means this is indistinguishable from an
      order number nobody ever issued - the heading says the order was not
      found, never whether it exists.
    */
    what: 'an order confirmation opened without the access cookie',
    path: '/zamowienie/2026-09-9999',
    headingPl: 'Nie znaleziono takiego zamówienia',
  },
];

const ESCAPE_LINKS = ['Wróć na stronę główną', 'Zobacz kolekcje', 'Napisz do nas'] as const;

for (const { what, path, headingPl } of CASES) {
  test(`${what}: a specific heading, a way out, and a real title`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole('heading', { level: 1, name: headingPl })).toBeVisible();

    for (const label of ESCAPE_LINKS) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }

    // Not „RYT". The tab has to say which kind of thing was missing, because
    // that is all a visitor has to go on when they come back to the window.
    expect(await page.title()).toContain(headingPl);

    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveCount(1);
  });
}

test('the way out actually goes somewhere', async ({ page }) => {
  /*
    Not a formality. The first version of `NotFoundContent` offered „Przeglądaj
    wzory" → `/wzory`, which is itself deliberately `notFound()`-ed at the
    owner's request: a 404 page whose escape route was another 404. That was
    found by clicking it, not by reading it, so it is clicked here.
  */
  await page.goto('/nie-ma-takiej-kategorii');
  await page.getByRole('link', { name: 'Zobacz kolekcje' }).click();

  await expect(page).toHaveURL(/\/kolekcje$/);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Nie znaleziono/);
});

/**
 * `docs/AI-CHECKLIST.md` BUG-16 - the sitemap listed the catalogue and
 * nothing else.
 *
 * It carried the home page, `/blog`, every category, every product and every
 * blog post, and omitted `/kolekcje` and its children, every admin-authored
 * `/strony/[slug]`, `/faq`, `/o-nas`, `/kontakt` and both legal pages. The
 * collections are a real merchandising surface the shop links to from its own
 * navigation, and the static pages are the ones an admin can create without
 * touching the code - so they are exactly the pages nobody would remember to
 * add by hand, which is the argument for generating them.
 *
 * Driven against real Postgres because that is what a sitemap is: a query.
 * The absences are asserted as deliberately as the presences - a sitemap that
 * advertises a 404 or a `noindex` page is worse than one that omits it, and
 * both mistakes are easy to make by adding routes mechanically.
 */

import { describe, expect, it } from 'vitest';

import sitemap from '@/app/sitemap';
import { prisma } from '@/server/db/client';

async function urls(): Promise<readonly string[]> {
  return (await sitemap()).map((entry) => entry.url.replace(/^https?:\/\/[^/]+/, '') || '/');
}

describe('sitemap - the fixed public pages', () => {
  it.each([
    ['/', 'the home page'],
    ['/blog', 'the blog index'],
    ['/kolekcje', 'the collections index, linked from the shop\'s own navigation'],
    ['/faq', 'FAQ'],
    ['/o-nas', 'about'],
    ['/kontakt', 'contact'],
    ['/regulamin', 'terms - a legal page a customer may well search for'],
    ['/polityka-prywatnosci', 'the privacy policy, for the same reason'],
  ])('lists %s - %s', async (path, _why) => {
    expect(await urls()).toContain(path);
  });
});

describe('sitemap - what it must not advertise', () => {
  it.each([
    ['/szukaj', 'search results are `index: false`; listing them contradicts the page'],
    ['/koszyk', 'a session-specific cart'],
    ['/moje-konto', "one customer's own pages"],
    ['/panel', 'the admin panel'],
    ['/wzory', 'this route calls notFound() while pattern selection is off - a sitemap must not point at a 404'],
  ])('omits %s - %s', async (path, _why) => {
    expect(await urls()).not.toContain(path);
  });

  it('never lists a guest order confirmation', async () => {
    /*
       Their URLs carry the access token. A shape rather than a path, so it
       stays true whatever order numbers exist in the database this runs
       against.

       The trailing slash is not cosmetic and this assertion found out why:
       without it the check also matched `/zamowienie-wlasne`, a real and
       entirely public product category. A guard that fails on a legitimate
       page is a guard that gets deleted.
    */
    expect((await urls()).some((url) => url.startsWith('/zamowienie/'))).toBe(false);
  });
});

describe('sitemap - the generated entries', () => {
  it('lists every active collection', async () => {
    const collections = await prisma.productCollection.findMany({ where: { isActive: true }, select: { slug: true } });
    const listed = await urls();

    // A shop with no collections is a legitimate state; asserting on a
    // non-empty database would make this test about the seed instead.
    for (const collection of collections) {
      expect(listed).toContain(`/kolekcje/${collection.slug}`);
    }
  });

  it('lists every active admin-authored page', async () => {
    const pages = await prisma.staticPage.findMany({ where: { isActive: true }, select: { slug: true } });
    const listed = await urls();

    for (const page of pages) {
      expect(listed).toContain(`/strony/${page.slug}`);
    }
  });

  it('never lists two URLs for the same page', async () => {
    /*
      Found on 2026-09-05 by looking at the generated sitemap rather than at
      the code: `/o-nas` is a hand-built marketing route AND `o-nas` is a
      seeded `StaticPage`, so `/strony/o-nas` renders a second, different page
      under the same „O nas - RYT" title. Both are public and both were about
      to be advertised.

      Whether the stub should exist at all is the owner's call and is recorded
      separately. What is not a judgement call is that a sitemap must not
      offer a crawler two URLs for one page, so the first-class route wins and
      the `/strony/` twin is left out.
    */
    /*
      Self-seeded, and that is not incidental. Written first as a plain scan
      of the generated sitemap, it passed immediately - because the *test*
      database happens to hold no colliding page, while the development
      database does. A test that silently exercises nothing is worse than no
      test, so this creates the collision it is about.
    */
    const slug = 'regulamin';
    const existing = await prisma.staticPage.findUnique({ where: { slug } });
    if (existing === null) {
      await prisma.staticPage.create({
        data: { slug, titlePl: 'Test', bodyPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test', isActive: true },
      });
    }

    try {
      const listed = await urls();

      // The first-class route is there...
      expect(listed).toContain('/regulamin');
      // ...and its `/strony/` twin is not.
      expect(listed).not.toContain('/strony/regulamin');

      // And the rule generally, across whatever else this database holds.
      const twins = listed.filter((url) => url.startsWith('/strony/')).map((url) => url.replace('/strony', ''));
      expect(twins.filter((path) => listed.includes(path))).toEqual([]);
    } finally {
      if (existing === null) {
        await prisma.staticPage.deleteMany({ where: { slug } });
      }
    }
  });

  it('leaves out an inactive collection', async () => {
    // The distinction the whole sitemap turns on: retired, not destroyed.
    // `/kolekcje/[slug]` 404s for an inactive one, so advertising it would
    // send a crawler to a dead page.
    const slug = `test-sitemap-${crypto.randomUUID()}`;
    await prisma.productCollection.create({
      data: { slug, namePl: 'Test', descPl: 'Test', isActive: false },
    });

    try {
      expect(await urls()).not.toContain(`/kolekcje/${slug}`);
    } finally {
      await prisma.productCollection.deleteMany({ where: { slug } });
    }
  });
});

/**
 * `docs/AI-CHECKLIST.md` BUG-17 - `robots.ts` allowed crawling everything.
 *
 * `rules: { userAgent: '*', allow: '/' }` invited crawlers into `/panel`,
 * `/moje-konto`, `/koszyk`, and - the one that matters most - the guest order
 * confirmation at `/zamowienie/[orderNumber]?token=...`, whose query string
 * *is* the credential. Only `/szukaj` set `robots: { index: false }`, and it
 * did so on the page rather than here.
 *
 * **Two mechanisms, and they do different jobs.** This file stops polite
 * crawlers fetching a URL. It does **not** remove one already known from the
 * index: a `Disallow`ed URL that something links to can still be listed,
 * without content, precisely because the crawler was told not to look at it.
 * Only a `noindex` on the page itself does that, and it is only seen by a
 * crawler allowed to fetch the page. So the private routes carry both, and
 * `robots-noindex.test.ts` pins the other half.
 *
 * A pure function with no request context, so it is genuinely unit-testable -
 * which is why the rule lives here rather than in a comment.
 */

import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';

/** Every path a crawler must be kept out of, with why. */
const MUST_BE_DISALLOWED: readonly (readonly [string, string])[] = [
  ['/panel', 'the whole admin panel'],
  ['/moje-konto', "a customer's own orders, projects and uploaded designs"],
  ['/koszyk', 'a session-specific cart, meaningless to anyone else'],
  ['/zamowienie/', 'guest order confirmations, whose ?token= query string is the credential'],
  ['/logowanie', 'a sign-in form is not a search result'],
  ['/rejestracja', 'nor is a sign-up form'],
  ['/szukaj', 'unbounded query-string URLs, each a near-duplicate of the catalogue'],
];

function disallowedPaths(): readonly string[] {
  const { rules } = robots();
  const all = Array.isArray(rules) ? rules : [rules];
  return all.flatMap((rule) => {
    const disallow = rule.disallow ?? [];
    return Array.isArray(disallow) ? disallow : [disallow];
  });
}

describe('robots.txt', () => {
  it.each(MUST_BE_DISALLOWED)('keeps crawlers out of %s - %s', (path, _why) => {
    expect(disallowedPaths()).toContain(path);
  });

  it('still lets the catalogue be crawled - the shop needs to be findable', () => {
    const { rules } = robots();
    const all = Array.isArray(rules) ? rules : [rules];
    const allowed = all.flatMap((rule) => {
      const allow = rule.allow ?? [];
      return Array.isArray(allow) ? allow : [allow];
    });

    expect(allowed).toContain('/');
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

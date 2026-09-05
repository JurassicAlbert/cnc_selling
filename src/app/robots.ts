import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * `docs/AI-CHECKLIST.md` BUG-17.
 *
 * This used to be `allow: '/'` and nothing else, which invited crawlers into
 * the admin panel, every customer's account pages, session-specific carts,
 * and - the one that actually matters - the guest order confirmation at
 * `/zamowienie/[orderNumber]?token=...`, whose query string **is** the
 * credential. A crawled URL ends up in logs, in `Referer` headers and
 * potentially in a search index.
 *
 * **`Disallow` is half the job, and the smaller half.** It stops a polite
 * crawler *fetching* a URL. It does not remove one already known: a
 * disallowed URL that something links to can still be listed, without a
 * snippet, exactly because the crawler was told not to look. Only a
 * `noindex` on the page removes it, and that is only seen by a crawler
 * allowed to fetch the page. So the private routes carry `robots: { index:
 * false }` in their own metadata as well, and neither mechanism is redundant.
 *
 * Neither is a security control. Both are requests, honoured by the crawlers
 * that choose to. Order confirmations are protected by the token comparison
 * in the page itself; `/panel` and `/moje-konto` by their session gates.
 * This exists so the shop does not *publish* those URLs to anyone who asks
 * politely - BUG-22 covers the separate question of the token travelling in a
 * query string at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Staff only, behind a session gate. Nothing here is a search result.
        '/panel',
        // One customer's own orders, saved projects and uploaded designs.
        '/moje-konto',
        // A cart belongs to one session and means nothing to anyone else.
        '/koszyk',
        // The trailing slash is deliberate: this covers
        // `/zamowienie/2026-08-0042?token=…` and `/zamowienie/sprawdz`,
        // without also matching some future `/zamowienia-hurtowe` page.
        '/zamowienie/',
        // Forms, not content. Indexing them competes with the pages that
        // should rank and offers a searcher nothing.
        '/logowanie',
        '/rejestracja',
        // Unbounded query-string URLs, each a near-duplicate of the
        // catalogue. Already `index: false` on the page since it was built;
        // this stops the crawl as well as the indexing.
        '/szukaj',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

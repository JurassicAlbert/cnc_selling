import Link from 'next/link';

import { ExpandMoreIcon, GridViewIcon, SearchIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

type CategoryOption = {
  readonly slug: string;
  readonly namePl: string;
};

/**
 * The search band - the search form, and a category menu beside it.
 *
 * Deliberately NOT MUI, and that is not an oversight the 2026-08-30 audit
 * missed: this renders on every single storefront page, and the storefront
 * chrome is kept free of a client theme provider for measured LCP reasons
 * (`theme-vars.css`'s own header). Converting it would trade a real
 * performance property for a cosmetic one.
 *
 * What the audit DID fix here is accessibility (P2-10/§11): the input had no
 * accessible name at all. A placeholder is not a label - it is not announced
 * as one by screen readers and it vanishes the moment anyone types - so this
 * carries a real `aria-label`, and a visible `:focus-visible` ring.
 *
 * **2026-09-04, second pass.** The category list used to be a `<select
 * name="k">` inside the form, narrowing the search. The owner removed that
 * job from it: "nie potrzebujemy listy rozwijanej kategorii jako opcji
 * wyszukiwania - wyszukiwanie dobrze sobie radzi bez tego, za to możemy tą
 * listę rozwijaną kategorii traktować jako quick access". So it is now a
 * menu of links that go straight to a category, sitting beside the form
 * rather than welded to it, with real space between them.
 *
 * `searchActiveProducts` keeps its category parameter and `/szukaj?k=…`
 * still works - it is tested, it is a legitimate deep link, and removing a
 * working server capability because one control stopped sending it would be
 * throwing away more than was asked for. Nothing in the UI sends it now.
 *
 * Still zero client JS. The menu is a `<details>`, the same pattern the main
 * navigation already uses, so it opens without a single byte of script.
 */
export function SearchBar({ categories }: { readonly categories: readonly CategoryOption[] }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--mui-palette-background-default)',
        borderBottom: '1px solid var(--mui-palette-divider)',
      }}
    >
      <Container>
        <div className="search-band">
          {/*
            Quick access to a category, not a filter. It is a sibling of the
            form, not a child: nothing it does is submitted, and putting a
            menu of links inside a GET form would be claiming otherwise.

            The `<nav>` around the `<details>` is not decoration either. This
            is a set of links to elsewhere on the site, which is what the
            landmark is for, and it gives the menu an accessible name - a
            bare `<summary>` does not reliably carry one. Checked in the
            browser, where it came back as a `generic` with no name at all,
            so nothing announced what the control opened and no role-based
            locator could reach it.
          */}
          <nav aria-label={SITE.searchCategoryMenuPl} className="search-quick-access">
            <details className="nav-dropdown">
              <summary className="search-quick-access-summary">
                <GridViewIcon size={18} />
                {SITE.searchCategoryMenuPl}
                <ExpandMoreIcon size={16} className="nav-dropdown-chevron" style={{ marginInlineStart: 2 }} />
              </summary>
              <div className="nav-dropdown-panel">
                {categories.map((category) => (
                  <Link key={category.slug} href={`/${category.slug}`} className="nav-dropdown-item">
                    {category.namePl}
                  </Link>
                ))}
              </div>
            </details>
          </nav>

          {/* The real `<search>` landmark rather than `role="search"` on the
              form - same semantics for assistive technology, no ARIA needed
              (§11: don't add ARIA where an element already says it). */}
          <search className="search-band-form">
            <form action="/szukaj" method="get" className="search-form">
              <div className="search-group">
                <input
                  type="search"
                  name="q"
                  aria-label={SITE.searchPlaceholderPl}
                  placeholder={SITE.searchPlaceholderPl}
                  className="search-input"
                />

                <button type="submit" aria-label={SITE.searchButtonLabelPl} className="search-submit">
                  <SearchIcon size={18} />
                  <span className="search-submit-text">{SITE.searchButtonLabelPl}</span>
                </button>
              </div>
            </form>
          </search>
        </div>
      </Container>
    </div>
  );
}

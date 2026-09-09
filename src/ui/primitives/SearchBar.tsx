import Link from 'next/link';

import { ExpandMoreIcon, GridViewIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SearchForm } from '@/ui/primitives/SearchForm';
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
 * accessible name at all. That field now lives in `SearchForm`, which
 * carries the name and the focus ring with it.
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
 * **2026-09-09, RWD-04: this band is desktop-only.** It cost 128 px of a
 * 375 px-wide screen - the pill and the field stacked into two rows - on
 * every route including the cart, the checkout and every account page, and
 * `.search-band-section` hides it below the burger's own 900 px breakpoint.
 * Neither of its two jobs is lost there: the categories are the burger's
 * „Produkty" menu, which already listed exactly the same links, and the
 * field is behind the header's magnifier. Both are asserted in
 * `tests/e2e/mobile-rwd.spec.ts`.
 *
 * Still zero client JS. The menu is a `<details>`, the same pattern the main
 * navigation already uses, so it opens without a single byte of script.
 */
export function SearchBar({ categories }: { readonly categories: readonly CategoryOption[] }) {
  return (
    <div
      className="search-band-section"
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

          <SearchForm />
        </div>
      </Container>
    </div>
  );
}

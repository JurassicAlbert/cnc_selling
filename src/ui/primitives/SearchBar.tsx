import { SearchIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

type CategoryOption = {
  readonly slug: string;
  readonly namePl: string;
};

/**
 * The search form, extracted out of `SiteHeader` into its own banded
 * section (2026-08-25) - the owner's explicit feedback was that search
 * belongs below the nav bar as its own section, not squeezed into the nav
 * row. Same GET-form pattern as before, zero client JS.
 *
 * Deliberately NOT MUI, and that is not an oversight the 2026-08-30 audit
 * missed: this renders on every single storefront page, and the storefront
 * chrome is kept free of a client theme provider for measured LCP reasons
 * (`theme-vars.css`'s own header). Converting it would trade a real
 * performance property for a cosmetic one.
 *
 * What the audit DID fix here is accessibility (P2-10/§11): the input had
 * no accessible name at all. A placeholder is not a label - it is not
 * announced as one by screen readers and it vanishes the moment anyone
 * types - so this now carries a real `aria-label`, and a visible
 * `:focus-visible` ring (`theme-vars.css`) so keyboard users can see where
 * they are.
 *
 * **2026-09-04, UX-23** (owner request, arrangement taken from
 * `template.getbazaar.io`): the category selector is attached to the left
 * of the field so the three controls read as one, and the whole thing now
 * owns the full width of the band rather than sitting at 480px against a
 * lot of empty space.
 *
 * The selector is a plain `<select name="k">` inside the same GET form -
 * no client JS, and it submits with everything else. It **narrows for
 * real**: `searchActiveProducts` takes the slug and `/szukaj` resolves it
 * against the live category list. A control that appears to filter and does
 * not would be the same class of thing as a price we will not honour.
 *
 * Choosing a category and pressing the button with an empty field is a
 * legitimate request - "show me what is in here" - and the results page
 * answers it by listing the category, rather than treating it as a search
 * for nothing.
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
        {/* The real `<search>` landmark rather than `role="search"` on the
            form - same semantics for assistive technology, no ARIA needed
            (§11: don't add ARIA where an element already says it). */}
        <search>
          <form action="/szukaj" method="get" className="search-form">
            {/*
              One bordered group holding the selector, the field and the
              button, so they read as a single control the way the reference
              layout does. The border lives on this wrapper rather than on
              each child, which is what stops the seams between them showing
              as doubled 2px lines.

              It wraps rather than scrolls below the breakpoint: on a phone
              the selector drops onto its own line above the field, which
              keeps every control full-size and tappable instead of shrinking
              three of them into one cramped row.
            */}
            <div className="search-group">
              <label htmlFor="search-category" className="search-category-label">
                {SITE.searchCategoryLabelPl}
              </label>
              <select id="search-category" name="k" className="search-category">
                {/*
                  An empty value, so an unnarrowed search does not carry a
                  meaningless `k=` through every shared URL.
                */}
                <option value="">{SITE.searchAllCategoriesPl}</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.namePl}
                  </option>
                ))}
              </select>

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
      </Container>
    </div>
  );
}

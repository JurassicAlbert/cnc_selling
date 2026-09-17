import { SearchIcon } from '@/ui/icons';
import { SITE } from '@/content/pl/site';

/**
 * The search field itself, extracted from `SearchBar` for RWD-04.
 *
 * It now has two homes: the full-width band below the header (desktop), and
 * the disclosure behind the header's magnifier (below 900 px, where the band
 * is gone). Both render this, so there is one search form to fix rather than
 * two that drift - the same reason `PasswordField` exists.
 *
 * Only one of the two is ever in the accessibility tree: the other is
 * `display: none` at that width, so a screen reader and a role-based locator
 * both see exactly one search box.
 *
 * The real `<search>` landmark rather than `role="search"` on the form -
 * same semantics for assistive technology, no ARIA needed (§11: don't add
 * ARIA where an element already says it).
 */
export function SearchForm() {
  return (
    <search className="search-band-form">
      <form action="/szukaj" method="get" className="search-form">
        <div className="search-group">
          {/* A placeholder is not a label: it is not announced as one and it
              vanishes the moment anyone types, so the name is real. */}
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
  );
}

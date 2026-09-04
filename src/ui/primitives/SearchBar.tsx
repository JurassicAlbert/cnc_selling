import { SearchIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

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
 */
export function SearchBar() {
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
          <form
            action="/szukaj"
            method="get"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              paddingBlock: 'var(--space-3)',
            }}
          >
            <input
              type="search"
              name="q"
              aria-label={SITE.searchPlaceholderPl}
              placeholder={SITE.searchPlaceholderPl}
              style={{
                font: 'var(--mui-font-body1)',
                padding: '10px 14px',
                border: '1px solid var(--mui-palette-divider)',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--mui-palette-background-paper)',
                color: 'var(--mui-palette-text-primary)',
                width: '100%',
                maxWidth: 480,
              }}
            />
            <button
              type="submit"
              aria-label={SITE.searchButtonLabelPl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                font: 'var(--mui-font-button)',
                letterSpacing: 'var(--mui-letter-spacing-button)',
                border: 'none',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--mui-palette-primary-main)',
                color: 'var(--mui-palette-background-paper)',
                cursor: 'pointer',
                padding: '10px 18px',
              }}
            >
              <SearchIcon size={18} />
              {SITE.searchButtonLabelPl}
            </button>
          </form>
        </search>
      </Container>
    </div>
  );
}

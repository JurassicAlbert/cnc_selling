import { SearchIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

/**
 * The search form, extracted out of `SiteHeader` into its own banded
 * section (2026-08-25) — the owner's explicit feedback was that search
 * belongs below the nav bar as its own section, not squeezed into the nav
 * row. Same GET-form pattern as before, zero client JS.
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
      </Container>
    </div>
  );
}

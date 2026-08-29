import Link from 'next/link';

import { CartIcon, PrecisionManufacturingIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { logout } from '@/server/actions/auth';
import { SITE } from '@/content/pl/site';

type CategoryLink = {
  readonly slug: string;
  readonly namePl: string;
};

type SiteHeaderProps = {
  readonly categories: readonly CategoryLink[];
  readonly session: { readonly name: string } | null;
};

/**
 * Pure presentational RSC — the category list is fetched once in
 * `layout.tsx` and passed down here (and to `Footer`), rather than each
 * component querying `listActiveCategories()` independently.
 *
 * Redesigned 2026-08-25 for real visual weight (icon mark, a working cart
 * link, `--shadow-sm`, hover states via the `.nav-link`/`.cart-link`
 * utility classes in `theme-vars.css`) and to move search out into its own
 * `SearchBar` section below — see that file and the owner's explicit
 * feedback recorded in `docs/HANDOVER.md`.
 *
 * **2026-08-29 restructure, owner request**: a flat list of category links
 * plus "Wzory"/"Kolekcje"/"Moje konto" doesn't scale — real navbar now:
 * "Produkty" (every category, in a dropdown) / "O nas" / "FAQ" / "Kolekcje"
 * / "Koszyk" / account (a dropdown — jump to a specific account tab, or
 * log out — instead of a single "Moje konto" link). "Wzory" is gone from
 * the navbar entirely — the pattern-browsing page itself is hidden for now
 * (`(marketing)/wzory/page.tsx`'s own header comment), so linking to it
 * would be a dead end.
 *
 * Both dropdowns are native `<details>`/`<summary>` — zero client JS, same
 * "prefer a real HTML mechanism over a client island" discipline this
 * project already applies to `/faq`'s accordion and every Server Action
 * form. `<details>` closes on an outside click in every real browser
 * without extra script (native behavior, not something added here).
 */
export function SiteHeader({ categories, session }: SiteHeaderProps) {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--mui-palette-divider)',
        backgroundColor: 'var(--mui-palette-background-paper)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Container>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-5)',
            paddingBlock: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              font: 'var(--mui-font-h6)',
              color: 'var(--mui-palette-text-primary)',
              textDecoration: 'none',
            }}
          >
            <PrecisionManufacturingIcon size={22} style={{ color: 'var(--mui-palette-secondary-main)' }} />
            RYT
          </Link>

          <details className="nav-dropdown">
            <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
              {SITE.headerProductsMenuPl}
            </summary>
            <div className="nav-dropdown-panel">
              {categories.map((category) => (
                <Link key={category.slug} href={`/${category.slug}`} className="nav-dropdown-item">
                  {category.namePl}
                </Link>
              ))}
            </div>
          </details>

          <Link href="/o-nas" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.aboutHeadingPl}
          </Link>
          <Link href="/faq" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.headerFaqLinkPl}
          </Link>
          <Link href="/kolekcje" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.footerCollectionsLinkPl}
          </Link>

          <Link
            href="/koszyk"
            className="cart-link"
            style={{ font: 'var(--mui-font-body2)', marginInlineStart: 'auto' }}
          >
            <CartIcon size={20} />
            {SITE.cartHeadingPl}
          </Link>

          {session !== null ? (
            <details className="nav-dropdown">
              <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
                {SITE.headerAccountLinkPl}
              </summary>
              <div className="nav-dropdown-panel" style={{ insetInlineEnd: 0, insetInlineStart: 'auto' }}>
                <Link href="/moje-konto" className="nav-dropdown-item">
                  {SITE.headerAccountLinkPl}
                </Link>
                <Link href="/moje-konto/zamowienia" className="nav-dropdown-item">
                  {SITE.accountNavOrdersPl}
                </Link>
                <Link href="/moje-konto/projekty" className="nav-dropdown-item">
                  {SITE.accountNavConfigurationsPl}
                </Link>
                <Link href="/moje-konto/wzory" className="nav-dropdown-item">
                  {SITE.accountNavDesignsPl}
                </Link>
                <Link href="/moje-konto/pomoc" className="nav-dropdown-item">
                  {SITE.accountNavHelpPl}
                </Link>
                {/* A real `<form action={logout}>`, not an onClick handler —
                    same zero-extra-JS Server Action pattern `AccountNav.tsx`
                    already established for this exact button. */}
                <form action={logout}>
                  <button type="submit" className="nav-dropdown-item nav-dropdown-item--button">
                    {SITE.headerLogoutPl}
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <details className="nav-dropdown">
              <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
                {SITE.headerLoginLinkPl}
              </summary>
              <div className="nav-dropdown-panel" style={{ insetInlineEnd: 0, insetInlineStart: 'auto' }}>
                <Link href="/logowanie" className="nav-dropdown-item">
                  {SITE.headerLoginLinkPl}
                </Link>
                <Link href="/rejestracja" className="nav-dropdown-item">
                  {SITE.authSwitchToRegisterPl}
                </Link>
              </div>
            </details>
          )}
        </nav>
      </Container>
    </header>
  );
}

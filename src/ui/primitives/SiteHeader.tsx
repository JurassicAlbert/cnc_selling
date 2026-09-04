import Link from 'next/link';

import { formatPln } from '@/domain/money/money';
import {
  CartIcon,
  CloseIcon,
  CollectionsIcon,
  ExpandMoreIcon,
  GridViewIcon,
  HelpIcon,
  InfoIcon,
  MenuIcon,
  PersonIcon,
  PrecisionManufacturingIcon,
} from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { logout } from '@/server/actions/auth';
import { SITE } from '@/content/pl/site';

type CategoryLink = {
  readonly slug: string;
  readonly namePl: string;
};

type CollectionLink = {
  readonly slug: string;
  readonly namePl: string;
};

type CartSummary = {
  readonly itemCount: number;
  readonly totalGrossGrosze: number;
};

type SiteHeaderProps = {
  readonly categories: readonly CategoryLink[];
  readonly collections: readonly CollectionLink[];
  readonly cartSummary: CartSummary;
  readonly session: { readonly name: string } | null;
};

/**
 * Pure presentational RSC - the category list is fetched once in
 * `layout.tsx` and passed down here (and to `Footer`), rather than each
 * component querying `listActiveCategories()` independently.
 *
 * Redesigned 2026-08-25 for real visual weight (icon mark, a working cart
 * link, `--shadow-sm`, hover states via the `.nav-link`/`.cart-link`
 * utility classes in `theme-vars.css`) and to move search out into its own
 * `SearchBar` section below - see that file and the owner's explicit
 * feedback recorded in `docs/HANDOVER.md`.
 *
 * **2026-08-29 restructure, owner request**: a flat list of category links
 * plus "Wzory"/"Kolekcje"/"Moje konto" doesn't scale - real navbar now:
 * "Produkty" (every category, in a dropdown) / "O nas" / "FAQ" / "Kolekcje"
 * / "Koszyk" / account (a dropdown - jump to a specific account tab, or
 * log out - instead of a single "Moje konto" link). "Wzory" is gone from
 * the navbar entirely - the pattern-browsing page itself is hidden for now
 * (`(marketing)/wzory/page.tsx`'s own header comment), so linking to it
 * would be a dead end.
 *
 * Both dropdowns are native `<details>`/`<summary>` - zero client JS, same
 * "prefer a real HTML mechanism over a client island" discipline this
 * project already applies to `/faq`'s accordion and every Server Action
 * form. `<details>` closes on an outside click in every real browser
 * without extra script (native behavior, not something added here).
 *
 * **2026-08-29 UX pass, owner feedback**: "dodać ikony do elementów
 * nawigacji", "strzałki w jedną/drugą stronę przy liście rozwijanej",
 * "koło koszyka ... ładne UX pokazujące cenę i ilość elementów w koszyku
 * na bieżąco", "nawigacja 'kolekcje' ... też powinna być listą rozwijaną".
 * All still zero client JS: icons are the same RSC-safe inline-SVG set as
 * the rest of `ui/icons`, the chevron is one shared `ExpandMoreIcon`
 * rotated by the `.nav-dropdown[open]` CSS rule (`theme-vars.css`), and the
 * cart badge is a plain number read server-side by `StorefrontChrome`
 * (`getCartSummaryForRequest`) - never a client poll.
 */
export function SiteHeader({ categories, collections, cartSummary, session }: SiteHeaderProps) {
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
          className="site-header-nav"
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

          {/*
            Below 900px these four collapse behind a burger; above it the
            panel is styled back into a plain flex row and the toggle is
            hidden, so desktop markup and desktop appearance are unchanged.
            A `<details>` rather than a button because this header is a
            Server Component with no client JS at all - the same reason the
            dropdowns inside it are `<details>` too.

            The logo, the cart and the account menu stay outside: on a phone
            the cart is the one control a shopper must never have to open a
            menu to find.
          */}
          {/*
            A checkbox and a label, not the `<details>` this file uses for its
            dropdowns, and the difference matters. A closed `<details>` has its
            content hidden by the user agent through `::details-content`, which
            author CSS cannot reliably override, so the desktop row came out
            zero pixels wide - measured, not guessed. The checkbox puts the
            open/closed state entirely in CSS.

            It also fails in the right direction. The panel is visible by
            default and only hidden under the breakpoint, so a browser that
            ignores the media query, or loses the stylesheet altogether, shows
            the full navigation rather than none of it.
          */}
          <input
            type="checkbox"
            id="nav-burger-toggle"
            className="nav-burger-checkbox"
            aria-label={SITE.headerMenuTogglePl}
          />
          <label htmlFor="nav-burger-toggle" className="nav-burger-toggle">
            <MenuIcon size={22} className="nav-burger-open-icon" />
            <CloseIcon size={22} className="nav-burger-close-icon" />
          </label>
          {/*
            UX-23: the navigation sits in the centre of the row, with the
            cart and the account menu held to the end. `margin-inline: auto`
            on this panel is what does it - the auto margin used to live on
            the cart link, which pushed the nav hard against the logo and
            left the middle of the header empty.

            The rule is in `theme-vars.css` beside the rest of the burger's
            CSS, not inline here, because under the breakpoint the panel
            becomes a dropped-down column and the centring has to come off
            with it.
          */}
          <div className="nav-burger-panel nav-burger-panel--centred">
            <details className="nav-dropdown">
              <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
                <GridViewIcon size={18} />
                {SITE.headerProductsMenuPl}
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

            <Link href="/o-nas" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
              <InfoIcon size={18} />
              {SITE.aboutHeadingPl}
            </Link>
            <Link href="/faq" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
              <HelpIcon size={18} />
              {SITE.headerFaqLinkPl}
            </Link>

            <details className="nav-dropdown">
              <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
                <CollectionsIcon size={18} />
                {SITE.headerCollectionsMenuPl}
                <ExpandMoreIcon size={16} className="nav-dropdown-chevron" style={{ marginInlineStart: 2 }} />
              </summary>
              <div className="nav-dropdown-panel">
                <Link href="/kolekcje" className="nav-dropdown-item" style={{ fontWeight: 600 }}>
                  {SITE.headerAllCollectionsLinkPl}
                </Link>
                {collections.map((collection) => (
                  <Link key={collection.slug} href={`/kolekcje/${collection.slug}`} className="nav-dropdown-item">
                    {collection.namePl}
                  </Link>
                ))}
              </div>
            </details>
          </div>

          {/*
            The word and the running total are wrapped so they can be dropped
            on a narrow screen (`theme-vars.css`). Below 600px the logo, the
            burger, the cart and the account menu do not fit on one line
            together, and the row wrapped onto two - the icon and the count
            badge are what a shopper needs at that width; the label and the
            figure are on the cart page itself, one tap away.

            The label is clipped rather than `display: none`, so it stays in
            the accessibility tree: hiding it the first way left this link
            announced as „1", its count badge and nothing else.
          */}
          <Link href="/koszyk" className="cart-link" style={{ font: 'var(--mui-font-body2)' }}>
            <CartIcon size={20} />
            <span className="header-label-text">{SITE.cartHeadingPl}</span>
            {cartSummary.itemCount > 0 && (
              <>
                <span className="cart-count-badge" aria-hidden="true">
                  {cartSummary.itemCount}
                </span>
                <span
                  className="header-label-text"
                  style={{ font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}
                >
                  {formatPln(cartSummary.totalGrossGrosze)}
                </span>
              </>
            )}
          </Link>

          {session !== null ? (
            <details className="nav-dropdown">
              <summary className="nav-link" style={{ font: 'var(--mui-font-body2)', cursor: 'pointer', listStyle: 'none' }}>
                <PersonIcon size={18} />
                <span className="header-label-text">{SITE.headerAccountLinkPl}</span>
                <ExpandMoreIcon size={16} className="nav-dropdown-chevron" style={{ marginInlineStart: 2 }} />
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
                {/* A real `<form action={logout}>`, not an onClick handler -
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
                <PersonIcon size={18} />
                <span className="header-label-text">{SITE.headerLoginLinkPl}</span>
                <ExpandMoreIcon size={16} className="nav-dropdown-chevron" style={{ marginInlineStart: 2 }} />
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

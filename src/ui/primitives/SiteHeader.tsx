import Image from 'next/image';
import Link from 'next/link';

import { ArticleIcon, CartIcon, CloseIcon, CollectionsIcon, ExpandMoreIcon, GridViewIcon, HelpIcon, InfoIcon, MenuIcon, PersonIcon, SearchIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SearchForm } from '@/ui/primitives/SearchForm';
import { logout } from '@/server/actions/auth';
import { SITE } from '@/content/pl/site';
import { LoginDialog } from '@/ui/islands/auth/LoginDialog';

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
        {/*
          BUG-29: named, because it is not the only `nav` on the page. The
          category bar and the breadcrumbs are landmarks too, and a screen
          reader's landmark list read "navigation, navigation, Kategorie" -
          with the unlabelled one being the main menu somebody jumping by
          landmark is actually looking for.
        */}
        <nav
          aria-label={SITE.headerMainNavPl}
          className="site-header-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            /*
              RWD-04. The gap lives in `theme-vars.css` rather than here,
              because an inline style beats a stylesheet: the `max-width:
              599px` rule that tightens this row to 12px for a line of icons
              has been written since 2026-09-06 and was never in effect. The
              measured row still had 24px between every icon, which is what
              left no room for a fifth one.
            */
            paddingBlock: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          {/*
            The owner's carved wordmark, 2026-09-08, replacing the machine
            icon plus the word set in the body face. The icon goes with it
            rather than sitting beside it: a mark and a wordmark that both
            say "this is RYT" is one of them too many, and the carving is
            already the thing the shop sells.

            `alt="RYT"` gives the home link its accessible name - the image
            IS the name, so a decorative empty alt here would leave the only
            link to the home page unlabelled.

            Sized in CSS with the intrinsic ratio declared, so the browser
            reserves the right box before the file arrives; `preload` because
            it is above the fold on every page. This was the first use of
            `preload` in the repository; PERF-06 finished the job on
            2026-09-10, so `priority` - deprecated in Next 16 - is gone
            everywhere now.
          */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Image
              src="/images/brand/ryt-wordmark.png"
              alt="RYT"
              width={900}
              height={356}
              sizes="140px"
              preload
              className="site-logo"
            />
          </Link>

          {/*
            Below 900px these five collapse behind a burger; above it the
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
            {/*
              UX-16, owner decision 2026-09-10: "Both in both places." The
              blog was linked from the footer and nowhere else, so it was
              invisible to anyone who never scrolled to the bottom - not a
              rule anybody chose, just what two separate additions left
              behind. FAQ made the same trip the other way, into the footer.

              Between the plain links and the Kolekcje dropdown, so the
              informational links stay together and the two dropdowns still
              bracket the row.
            */}
            <Link href="/blog" className="nav-link" style={{ font: 'var(--mui-font-body2)' }}>
              <ArticleIcon size={18} />
              {SITE.footerBlogLinkPl}
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
            RWD-04. Search on a phone: an icon here, and the band below the
            header gone entirely under 900px. It cost 128px of a 375px screen
            on every route - the cart, the checkout, every account page -
            which is more than the header itself.

            A checkbox and its label rather than a `<details>`, matching the
            burger beside it and for the same recorded reason: a closed
            `<details>` has its content hidden by the user agent through
            `::details-content`, which author CSS cannot reliably override.

            The panel is the LAST child of this row, not the next one after
            the label, and that ordering is load-bearing. It takes a full
            line when open (`flex: 1 0 100%`), so anything after it wraps
            below it - put here, the cart and the account menu would drop
            onto a third line the moment anyone opened the search.

            It also means the two panels never fight: this one is in flow, so
            the header grows and the burger's absolutely positioned panel
            (`top: 100%`) moves down with it instead of landing on top.
          */}
          <input
            type="checkbox"
            id="header-search-toggle"
            className="header-search-checkbox"
            aria-label={SITE.headerSearchTogglePl}
          />
          <label htmlFor="header-search-toggle" className="header-search-toggle">
            <SearchIcon size={20} className="header-search-open-icon" />
            <CloseIcon size={20} className="header-search-close-icon" />
          </label>

          {/*
            Owner request, 2026-09-06, against `template.getbazaar.io`: the
            cart is an icon and a count and nothing else. The word „Koszyk"
            and the running total used to sit beside it, clipped away below
            600px; both are on the cart page itself, one tap away.

            **The whole accessible name now comes from `aria-label`**, because
            there is no visible text left to build one from. That is not a
            regression of BUG-27 but the same fix carried over: the badge
            stays `aria-hidden` - read out on its own it announces a bare „1"
            in the middle of the name - and the label carries the word and the
            count together, in Polish's three plural forms.
            `accessibility.spec.ts` asserts a screen reader still hears how
            many items are in it.
          */}
          <Link
            href="/koszyk"
            className="cart-link nav-icon-link"
            aria-label={SITE.cartLinkLabelPl(cartSummary.itemCount)}
          >
            <CartIcon size={20} />
            {cartSummary.itemCount > 0 && (
              <span className="cart-count-badge" aria-hidden="true">
                {cartSummary.itemCount}
              </span>
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
            /*
              Owner request, 2026-09-06: signing in is a dialog and registering
              is its own page - the arrangement `template.getbazaar.io` uses.

              This replaces a two-item dropdown whose entire job was to offer
              those same two destinations, so the click that used to open a
              menu now opens the form itself. `LoginDialog` degrades to a plain
              link to `/logowanie` when JavaScript is absent or has not
              hydrated yet, and that page is unchanged: the session gate still
              redirects to it with `?next=`, and several e2e journeys sign in
              through it directly.
            */
            <LoginDialog />
          )}

          {/* Same `SearchForm` the band renders, so there is one search form
              on the site rather than two that drift. Only ever one of them is
              in the accessibility tree: the other is `display: none` at that
              width. */}
          <div className="header-search-panel">
            <SearchForm />
          </div>
        </nav>
      </Container>
    </header>
  );
}

import Link from 'next/link';

import { CartIcon, PrecisionManufacturingIcon } from '@/ui/icons';
import { Container } from '@/ui/primitives/Container';
import { SITE } from '@/content/pl/site';

type CategoryLink = {
  readonly slug: string;
  readonly namePl: string;
};

type SiteHeaderProps = {
  readonly categories: readonly CategoryLink[];
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
 */
export function SiteHeader({ categories }: SiteHeaderProps) {
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
            CNC Selling
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              className="nav-link"
              style={{ font: 'var(--mui-font-body2)' }}
            >
              {category.namePl}
            </Link>
          ))}

          <Link
            href="/koszyk"
            className="cart-link"
            style={{ font: 'var(--mui-font-body2)', marginInlineStart: 'auto' }}
          >
            <CartIcon size={20} />
            {SITE.cartHeadingPl}
          </Link>
        </nav>
      </Container>
    </header>
  );
}

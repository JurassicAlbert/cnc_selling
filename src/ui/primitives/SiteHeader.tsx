import Link from 'next/link';

import { listActiveCategories } from '@/server/repositories/categories';
import { Container } from '@/ui/primitives/Container';
import { SearchIcon } from '@/ui/icons';
import { SITE } from '@/content/pl/site';

/**
 * RSC — reads categories directly from the DB on every request. Fine at this
 * scale; revisit with a cache/ISR strategy if the category list ever gets
 * large enough for a per-request query to matter.
 */
export async function SiteHeader() {
  const categories = await listActiveCategories();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--mui-palette-divider)',
        backgroundColor: 'var(--mui-palette-background-paper)',
      }}
    >
      <Container>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            paddingBlock: 16,
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}
          >
            CNC Selling
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-primary)' }}
            >
              {category.namePl}
            </Link>
          ))}

          <form
            action="/szukaj"
            method="get"
            style={{ display: 'flex', alignItems: 'center', marginInlineStart: 'auto', gap: 4 }}
          >
            <input
              type="search"
              name="q"
              placeholder={SITE.searchPlaceholderPl}
              style={{
                font: 'var(--mui-font-body2)',
                padding: '6px 10px',
                border: '1px solid var(--mui-palette-divider)',
                borderRadius: 2,
                backgroundColor: 'var(--mui-palette-background-default)',
                color: 'var(--mui-palette-text-primary)',
                width: 160,
              }}
            />
            <button
              type="submit"
              aria-label={SITE.searchButtonLabelPl}
              style={{
                display: 'flex',
                alignItems: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--mui-palette-text-primary)',
              }}
            >
              <SearchIcon size={20} />
            </button>
          </form>
        </nav>
      </Container>
    </header>
  );
}

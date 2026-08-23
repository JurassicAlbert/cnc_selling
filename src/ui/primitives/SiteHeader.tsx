import Link from 'next/link';

import { listActiveCategories } from '@/server/repositories/categories';
import { Container } from '@/ui/primitives/Container';

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
        </nav>
      </Container>
    </header>
  );
}

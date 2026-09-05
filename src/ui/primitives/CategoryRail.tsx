import Link from 'next/link';

import { Container } from '@/ui/primitives/Container';

type CategoryLink = {
  readonly slug: string;
  readonly namePl: string;
};

/**
 * A horizontal row of category links - UX-23, owner request 2026-09-04:
 * "categories when on cart view".
 *
 * It earns its place on that page specifically. The cart is where a customer
 * either checks out or leaves, and the only way back into the catalogue from
 * here was the header's „Produkty" dropdown. On an empty cart it matters
 * more still: „Twój koszyk jest pusty" plus a single link is a dead end.
 *
 * A Server Component with no client JS and no MUI, like the rest of the
 * storefront chrome (`ARCHITECTURE.md` §2.1). It scrolls horizontally rather
 * than wrapping, so the row stays one line at any width and never pushes the
 * summary panel down the page.
 *
 * Renders nothing at all when there are no active categories, rather than an
 * empty headed band - the same "no empty chrome" rule the footer follows.
 */
export function CategoryRail({
  categories,
  headingPl,
}: {
  readonly categories: readonly CategoryLink[];
  readonly headingPl: string;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="category-rail">
      <Container>
        {/*
          An `<h2>` for the document outline, sized like a section label
          rather than a headline: the rail is a way back into the catalogue,
          not a second title competing with „Koszyk" above it. Dropping to an
          `<h3>` to get the smaller type would leave a hole in the heading
          structure instead.

          Written out rather than using the `Heading` primitive, which bakes
          `font: var(--mui-font-h2)` into an inline style - a stylesheet rule
          cannot override that, and adding `!important` to win an argument
          with our own component is worse than one explicit heading. The
          other properties are `Heading`'s, kept so this still looks like
          every other heading on the site.
        */}
        <h2
          style={{
            font: 'var(--mui-font-h6)',
            letterSpacing: 'var(--mui-letter-spacing-h6)',
            color: 'var(--mui-palette-text-primary)',
            margin: 0,
          }}
        >
          {headingPl}
        </h2>
        <nav aria-label={headingPl} className="category-rail-track">
          {categories.map((category) => (
            <Link key={category.slug} href={`/${category.slug}`} className="category-rail-item">
              {category.namePl}
            </Link>
          ))}
        </nav>
      </Container>
    </div>
  );
}

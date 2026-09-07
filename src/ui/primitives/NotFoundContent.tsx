import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

type NotFoundContentProps = {
  /**
   * What was not found, when the route knows something more useful than
   * „strona" - UX-06. A `not-found.tsx` receives no props from Next.js, so
   * this is always passed by the boundary itself, never by the framework.
   */
  readonly headingPl?: string;
};

/**
 * The body of every 404 in the app, without any chrome of its own - which
 * is the entire reason it exists separately from the pages that render it.
 *
 * Next.js resolves `notFound()` to the nearest `not-found.tsx` and renders
 * it inside the layouts above that boundary. So a truly unmatched URL hits
 * `app/not-found.tsx`, which sits under the bare root layout and must
 * supply the storefront chrome itself - while a `notFound()` called from
 * inside `(shop)`/`(marketing)` hits that group's own boundary, where the
 * group layout has ALREADY rendered the chrome. Rendering it in both
 * places drew the header and search bar twice, live, on `/wzory`
 * (2026-08-30). Splitting the content out is what lets each boundary
 * decide.
 *
 * **The heading is a parameter as of UX-06, and the reason is the shape the
 * bug had.** Six routes can miss for an ordinary reason - a retired
 * category, an unpublished product, a collection link from an old
 * newsletter - and three of them had grown their own hand-written boundary
 * with a specific heading, the literal „404", and no links at all. So the
 * more precisely the site knew what was missing, the worse the page a
 * visitor got: the generic boundaries were the only ones offering a way
 * out. Taking the heading as a prop is what lets a boundary be specific
 * *and* keep the escape routes, rather than choosing between them.
 *
 * Kept as pure RSC with no MUI, matching the storefront chrome's own
 * lightweight rule (`theme-vars.css`).
 */
export function NotFoundContent({ headingPl = SITE.notFoundHeadingPl }: NotFoundContentProps = {}) {
  return (
    <Section>
      <Container>
        <Heading level={1}>{headingPl}</Heading>
        <div style={{ marginBlockStart: 12 }}>
          <Text muted>{SITE.notFoundBodyPl}</Text>
        </div>
        {/*
         * Every destination here is checked to be a real, reachable page.
         * The first version of this list offered "Przeglądaj wzory" →
         * `/wzory`, which is itself deliberately `notFound()`-ed at the
         * owner's request - a 404 page whose own escape route was another
         * 404. Found by actually clicking through it, not by reading it.
         *
         * The landmark's own label is fixed rather than taken from the
         * heading: a `<nav>` called „Nie znaleziono takiego produktu" tells a
         * screen-reader user what went wrong instead of what the landmark
         * contains, which is the one thing a landmark name is for.
         */}
        <nav
          aria-label={SITE.notFoundNavLabelPl}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBlockStart: 24 }}
        >
          <Link href="/">{SITE.notFoundHomeCtaPl}</Link>
          <Link href="/kolekcje">{SITE.notFoundCollectionsCtaPl}</Link>
          <Link href="/kontakt">{SITE.notFoundContactCtaPl}</Link>
        </nav>
      </Container>
    </Section>
  );
}

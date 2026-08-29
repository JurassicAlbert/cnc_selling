import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

/**
 * The body of every 404 in the app, without any chrome of its own — which
 * is the entire reason it exists separately from the pages that render it.
 *
 * Next.js resolves `notFound()` to the nearest `not-found.tsx` and renders
 * it inside the layouts above that boundary. So a truly unmatched URL hits
 * `app/not-found.tsx`, which sits under the bare root layout and must
 * supply the storefront chrome itself — while a `notFound()` called from
 * inside `(shop)`/`(marketing)` hits that group's own boundary, where the
 * group layout has ALREADY rendered the chrome. Rendering it in both
 * places drew the header and search bar twice, live, on `/wzory`
 * (2026-08-30). Splitting the content out is what lets each boundary
 * decide.
 *
 * Kept as pure RSC with no MUI, matching the storefront chrome's own
 * lightweight rule (`theme-vars.css`).
 */
export function NotFoundContent() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.notFoundHeadingPl}</Heading>
        <div style={{ marginBlockStart: 12 }}>
          <Text muted>{SITE.notFoundBodyPl}</Text>
        </div>
        {/*
         * Every destination here is checked to be a real, reachable page.
         * The first version of this list offered "Przeglądaj wzory" →
         * `/wzory`, which is itself deliberately `notFound()`-ed at the
         * owner's request — a 404 page whose own escape route was another
         * 404. Found by actually clicking through it, not by reading it.
         */}
        <nav
          aria-label={SITE.notFoundHeadingPl}
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

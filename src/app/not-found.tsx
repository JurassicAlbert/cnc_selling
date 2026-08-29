import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { StorefrontChrome } from '@/ui/layout/StorefrontChrome';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

/**
 * The catch-all 404 — `docs/AUDIT-2026-08-30.md` P2-10. There genuinely
 * wasn't one: several routes had their own (`produkt/[slug]`, `[category]`,
 * `blog/[slug]`), but every `notFound()` outside those — an order number
 * that isn't yours, a staff-only page reached as a `CUSTOMER` (§16.2's
 * "404, not 403" rule sends people here on purpose) — fell through to
 * Next.js's own black-and-white default. In Polish-language storefront
 * that reads as the site being broken rather than the address being wrong.
 *
 * Renders `StorefrontChrome` itself because a root `not-found.tsx` sits
 * directly under the true root layout, outside `(shop)`/`(marketing)` —
 * without this it would have no nav and no footer, which is exactly the
 * dead end a 404 must not be. Kept as pure RSC with no MUI, matching the
 * storefront's own chrome-stays-lightweight rule (`theme-vars.css`).
 */
export default function NotFound() {
  return (
    <StorefrontChrome>
      <Section>
        <Container>
          <Heading level={1}>{SITE.notFoundHeadingPl}</Heading>
          <div style={{ marginBlockStart: 12 }}>
            <Text muted>{SITE.notFoundBodyPl}</Text>
          </div>
          <nav
            aria-label={SITE.notFoundHeadingPl}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginBlockStart: 24 }}
          >
            <Link href="/">{SITE.notFoundHomeCtaPl}</Link>
            <Link href="/wzory">{SITE.notFoundPatternsCtaPl}</Link>
            <Link href="/kontakt">{SITE.notFoundContactCtaPl}</Link>
          </nav>
        </Container>
      </Section>
    </StorefrontChrome>
  );
}

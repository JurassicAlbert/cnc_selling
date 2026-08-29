import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { lookupOrder } from '@/server/actions/checkout';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { OrderLookupForm } from '@/ui/islands/OrderLookupForm';

export const metadata: Metadata = {
  title: SITE.orderLookupHeadingPl,
};

/**
 * Still zero-client-JS in the way that matters: the form just redirects to
 * the real confirmation URL, which does the actual lookup and constant-time
 * token check. Only the rendering moved into an island — `@mui/material` is
 * lint-forbidden directly inside `(shop)` Server Components
 * (`ARCHITECTURE.md` §2.1), so a real form has to live in
 * `src/ui/islands/`. `docs/AUDIT-2026-08-30.md` P2-10.
 */
export default function OrderLookupPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.orderLookupHeadingPl}</Heading>
        <div style={{ marginBlockStart: 24 }}>
          <ThemeRegistry>
            <OrderLookupForm action={lookupOrder} />
          </ThemeRegistry>
        </div>
      </Container>
    </Section>
  );
}

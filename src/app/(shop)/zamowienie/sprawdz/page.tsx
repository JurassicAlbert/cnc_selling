import type { Metadata } from 'next';

import { SITE } from '@/content/pl/site';
import { lookupOrder } from '@/server/actions/checkout';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';

export const metadata: Metadata = {
  title: SITE.orderLookupHeadingPl,
};

/**
 * Zero-client-JS, same as the cart page's own forms — this just redirects
 * to the real confirmation URL, which does the actual lookup and
 * constant-time token check.
 */
export default function OrderLookupPage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.orderLookupHeadingPl}</Heading>

        <form
          action={lookupOrder}
          style={{ marginBlockStart: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}
        >
          <label style={{ display: 'block' }}>
            {SITE.orderLookupOrderNumberLabelPl}
            <input type="text" name="orderNumber" placeholder="2026/08/0042" style={{ display: 'block', width: '100%' }} />
          </label>
          <label style={{ display: 'block' }}>
            {SITE.orderLookupTokenLabelPl}
            <input type="text" name="token" style={{ display: 'block', width: '100%' }} />
          </label>
          <button
            type="submit"
            style={{
              font: 'var(--mui-font-button)',
              padding: '12px 24px',
              background: 'var(--mui-palette-primary-main)',
              color: 'var(--mui-palette-background-paper)',
              border: 'none',
              borderRadius: 2,
            }}
          >
            {SITE.orderLookupSubmitPl}
          </button>
        </form>
      </Container>
    </Section>
  );
}

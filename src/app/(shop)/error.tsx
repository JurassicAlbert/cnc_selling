'use client';

/**
 * Error boundary for every `(shop)` route — `docs/AUDIT-2026-08-30.md` §7.
 *
 * There was no boundary between an individual shop page and the ROOT one,
 * so any failure anywhere in the store replaced the entire document, nav
 * and footer included, and left the customer with the browser back button
 * as their only way onward. This boundary renders inside `(shop)/layout.tsx`
 * — the storefront chrome survives, the failure stays scoped to the page
 * that broke, and the customer can simply keep shopping.
 *
 * `ThemeRegistry` is mounted here, not in the layout: this renders only on
 * a failure, so it never touches the hot path the chrome is deliberately
 * kept MUI-free for (`theme-vars.css`'s header).
 */

import { useEffect } from 'react';

import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { SegmentErrorPanel } from '@/ui/islands/SegmentErrorPanel';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export default function ShopError({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <Container>
        <ThemeRegistry>
          <SegmentErrorPanel digest={error.digest} onRetry={retry} />
        </ThemeRegistry>
      </Container>
    </Section>
  );
}

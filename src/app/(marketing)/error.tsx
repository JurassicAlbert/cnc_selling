'use client';

/**
 * Error boundary for every `(marketing)` route — the same reasoning as
 * `(shop)/error.tsx`, and it matters just as much here: the home page, the
 * blog, the FAQ and the pattern gallery are where most first-time visitors
 * land, and a failure there previously took the whole site's chrome down
 * with it (`docs/AUDIT-2026-08-30.md` §7).
 */

import { useEffect } from 'react';

import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { SegmentErrorPanel } from '@/ui/islands/SegmentErrorPanel';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export default function MarketingError({
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

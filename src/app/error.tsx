'use client';

/**
 * Root error boundary - `docs/ARCHITECTURE.md` §20's exact copy: "Coś
 * poszło nie tak... numer błędu: `ABC123`", using `error.digest` as that
 * correlation id (Next.js's own hash of the thrown error - the same value
 * that shows up in server-side logs, so a customer reporting it is
 * traceable back to a real log line, never a raw stack trace shown to
 * them).
 *
 * `retry` (not `reset`) is Next.js 16.3's stable prop for this - see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
 * /error.md`'s own version history table; `reset` still exists but `retry`
 * is the current one.
 *
 * 2026-08-30 (`docs/AUDIT-2026-08-30.md` P2-10): the actual UI moved into
 * `ErrorPanel`, a real MUI island wrapped in `ThemeRegistry` here - this
 * page was hand-styled `<h1>/<p>/<button>` with inline CSS variables, and
 * it is the one page a customer only ever reaches on a bad day. Mounting
 * `ThemeRegistry` on an error page costs nothing that matters: unlike the
 * storefront chrome (kept deliberately MUI-free for measured LCP reasons -
 * see `theme-vars.css`'s header) this renders on failures only, never on
 * the hot path.
 */

import { useEffect } from 'react';

import { ErrorPanel } from '@/ui/islands/ErrorPanel';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export default function RouteError({
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
    <ThemeRegistry>
      <ErrorPanel digest={error.digest} onRetry={retry} />
    </ThemeRegistry>
  );
}

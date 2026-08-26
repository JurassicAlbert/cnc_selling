'use client';

/**
 * Root error boundary — P6 Part F, `docs/ARCHITECTURE.md` §20's exact
 * copy: "Coś poszło nie tak... numer błędu: `ABC123`", using `error.digest`
 * as that correlation id (Next.js's own hash of the thrown error — the
 * same value that shows up in server-side logs, so a customer reporting it
 * is traceable back to a real log line, never a raw stack trace shown to
 * them).
 *
 * `retry` (not `reset`) is Next.js 16.3's stable prop for this — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
 * /error.md`'s own version history table; `reset` still exists but `retry`
 * is the current one.
 */

import { useEffect } from 'react';

import { COPY } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 16,
        maxWidth: 480,
        margin: '80px auto',
        padding: '0 24px',
      }}
    >
      <h1 style={{ font: 'var(--mui-font-h4)', margin: 0 }}>{SITE.errorPageHeadingPl}</h1>
      <p style={{ font: 'var(--mui-font-body1)', margin: 0 }}>{COPY.genericServerError}</p>
      {error.digest !== undefined && (
        <p style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-secondary)', margin: 0 }}>
          {SITE.errorPageCorrelationIdLabelPl}: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        style={{
          font: 'var(--mui-font-button)',
          padding: '10px 20px',
          background: 'var(--mui-palette-primary-main)',
          color: 'var(--mui-palette-background-paper)',
          border: 'none',
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        {SITE.errorPageRetryPl}
      </button>
    </div>
  );
}

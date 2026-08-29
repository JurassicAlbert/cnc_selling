'use client';

/**
 * The last-resort boundary: this catches errors thrown by the ROOT LAYOUT
 * itself, which `error.tsx` cannot — `error.tsx` renders inside the layout
 * that just failed. `docs/AUDIT-2026-08-30.md` P2-10 found there was no
 * such file at all, so a root-layout failure showed Next.js's own
 * unstyled English fallback.
 *
 * It replaces the root layout, so it must render its own `<html>`/`<body>`
 * — and deliberately uses no MUI, no fonts, no imports beyond copy: this
 * runs precisely when the normal rendering path is already broken, and
 * anything it depends on is one more thing that can fail with it. Inline
 * styles here are the correct choice, not the shortcut they would be
 * anywhere else — the stylesheet may be exactly what failed to load.
 */

import { SITE } from '@/content/pl/site';

export default function GlobalError({ error }: { readonly error: Error & { digest?: string } }) {
  return (
    <html lang="pl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', background: '#fff' }}>
        <main style={{ maxWidth: 480, margin: '15vh auto', padding: '0 24px' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{SITE.errorPageHeadingPl}</h1>
          <p style={{ lineHeight: 1.6, marginBottom: 12 }}>{SITE.errorPageBodyPl}</p>
          {error.digest !== undefined && (
            <p style={{ fontSize: 14, color: '#666' }}>
              {SITE.errorPageCorrelationIdLabelPl}: <code>{error.digest}</code>
            </p>
          )}
          <p style={{ marginTop: 24 }}>
            {/* A plain anchor, not `next/link`: a full document load is the
                right recovery when the router itself may be the casualty. */}
            <a href="/" style={{ color: '#1a1a1a' }}>
              {SITE.notFoundHomeCtaPl}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

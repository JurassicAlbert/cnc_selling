'use client';

/**
 * The RODO/cookie consent banner — P6 Part E. Only rendered by
 * `layout.tsx` when `readConsentChoice()` returned `null` (no choice made
 * yet this visit) — once a choice is made, `submitConsentChoice` revalidates
 * the layout and this component simply stops being rendered, no local
 * "dismissed" state needed.
 */

import { useState, useTransition } from 'react';

import { SITE } from '@/content/pl/site';
import { submitConsentChoice } from '@/server/actions/consent';

export function CookieConsentBanner() {
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  function choose(accepted: boolean) {
    setDismissed(true);
    startTransition(() => {
      void submitConsentChoice(accepted ? 'accepted' : 'declined');
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        padding: '16px 24px',
        background: 'var(--mui-palette-background-paper)',
        borderTop: '1px solid var(--mui-palette-divider)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <p style={{ font: 'var(--mui-font-body2)', margin: 0, flex: '1 1 320px' }}>{SITE.consentBannerTextPl}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={isPending}
          onClick={() => choose(false)}
          style={{
            font: 'var(--mui-font-button)',
            padding: '10px 20px',
            background: 'none',
            border: '1px solid var(--mui-palette-divider)',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          {SITE.consentBannerDeclinePl}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => choose(true)}
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
          {SITE.consentBannerAcceptPl}
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * The RODO/cookie consent banner - P6 Part E. Only rendered by
 * `layout.tsx` when `readConsentChoice()` returned `null` (no choice made
 * yet this visit) - once a choice is made, `submitConsentChoice` revalidates
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
      {/*
       * Declining is listed first and styled as the quieter of the two.
       * Not a stylistic choice: RODO/GDPR requires refusing to be as easy
       * as accepting, and the shared `.form-button*` classes
       * (`theme-vars.css`) give both real hover, disabled and focus states
       * without shipping MUI to a banner that renders on a first-time
       * visitor's very first page load.
       */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="form-button form-button-outlined"
          type="button"
          disabled={isPending}
          onClick={() => choose(false)}
        >
          {SITE.consentBannerDeclinePl}
        </button>
        <button className="form-button" type="button" disabled={isPending} onClick={() => choose(true)}>
          {SITE.consentBannerAcceptPl}
        </button>
      </div>
    </div>
  );
}

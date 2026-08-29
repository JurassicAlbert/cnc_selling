'use client';

/**
 * P9 continuation, 2026-08-28 — the heart toggle on `/wzory`'s design
 * cards. Optimistic: flips immediately, rolls back only if the action
 * comes back `ok: false` (e.g. the session expired between page load and
 * click) — a network-round-trip delay on every click would make a
 * favourite toggle feel broken for something this low-stakes.
 * `loggedIn === false` renders a disabled heart pointing at `/logowanie`
 * rather than hiding the control — same "always show the real state, degrade
 * gracefully" precedent as `checkoutNoPaymentMethodsPl`.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';

import { SITE } from '@/content/pl/site';
import { toggleFavoriteDesign } from '@/server/actions/design-favorites';
import { FavoriteBorderIcon, FavoriteIcon } from '@/ui/icons';

export function FavoriteDesignButton({
  designId,
  initiallyFavorited,
  loggedIn,
}: {
  readonly designId: string;
  readonly initiallyFavorited: boolean;
  readonly loggedIn: boolean;
}) {
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <Link
        href="/logowanie"
        aria-label={SITE.patternsFavoriteLoginRequiredPl}
        title={SITE.patternsFavoriteLoginRequiredPl}
        style={{
          display: 'inline-flex',
          // A 40px target, not the 20px icon — the same touch-size rule the
          // filter form's option rows follow (§11).
          inlineSize: 40,
          blockSize: 40,
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          color: 'var(--mui-palette-text-secondary)',
        }}
      >
        <FavoriteBorderIcon size={20} />
      </Link>
    );
  }

  const handleClick = () => {
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = await toggleFavoriteDesign(designId);
      if (!result.ok) {
        setFavorited(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={favorited ? SITE.patternsUnfavoritePl : SITE.patternsFavoritePl}
      title={favorited ? SITE.patternsUnfavoritePl : SITE.patternsFavoritePl}
      aria-pressed={favorited}
      style={{
        display: 'inline-flex',
        inlineSize: 40,
        blockSize: 40,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        borderRadius: '50%',
        cursor: pending ? 'progress' : 'pointer',
        padding: 0,
        color: favorited ? 'var(--mui-palette-error-main)' : 'var(--mui-palette-text-secondary)',
        transition: 'color 0.15s ease',
      }}
    >
      {favorited ? <FavoriteIcon size={20} /> : <FavoriteBorderIcon size={20} />}
    </button>
  );
}

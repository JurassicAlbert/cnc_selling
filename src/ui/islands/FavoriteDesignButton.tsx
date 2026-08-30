'use client';

/**
 * P9 continuation, 2026-08-28 — the heart toggle on the design cards.
 * Optimistic: flips immediately, rolls back only if the action comes back
 * `ok: false` (e.g. the session expired between page load and click) — a
 * network round trip on every click would make a favourite toggle feel
 * broken for something this low-stakes. `loggedIn === false` renders a
 * disabled-looking heart pointing at `/logowanie` rather than hiding the
 * control — the same "always show the real state, degrade gracefully"
 * precedent as `checkoutNoPaymentMethodsPl`.
 *
 * 2026-08-30: real MUI `IconButton` instead of a hand-styled `<button>` and
 * `<a>`. Both call sites already have `ThemeRegistry` above them, so this
 * costs no additional client runtime — it just stops this one control
 * missing the focus ring, hover state, disabled treatment and 40px touch
 * target every other button on the site gets for free. `component={Link}`
 * keeps the logged-out variant a real link (right-click, middle-click,
 * "open in new tab" all keep working) while looking identical to the
 * button beside it.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { IconButton } from '@mui/material';

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
      <IconButton
        component={Link}
        href="/logowanie"
        size="small"
        aria-label={SITE.patternsFavoriteLoginRequiredPl}
        title={SITE.patternsFavoriteLoginRequiredPl}
      >
        <FavoriteBorderIcon size={20} />
      </IconButton>
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
    <IconButton
      size="small"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? SITE.patternsUnfavoritePl : SITE.patternsFavoritePl}
      title={favorited ? SITE.patternsUnfavoritePl : SITE.patternsFavoritePl}
      // The only non-default here: a filled heart reads as "saved" and needs
      // to say so in colour, which no `IconButton` variant expresses.
      sx={{ color: favorited ? 'error.main' : 'text.secondary' }}
    >
      {favorited ? <FavoriteIcon size={20} /> : <FavoriteBorderIcon size={20} />}
    </IconButton>
  );
}

'use client';

/**
 * The in-page error panel for a route-group `error.tsx` — as opposed to
 * `ErrorPanel`, which the ROOT boundary renders when there is no chrome
 * left to sit inside.
 *
 * The difference is the whole point. A root boundary replaces the entire
 * document: nav, search, footer, everything. Before this existed that was
 * the ONLY boundary in the app, so any failure on any storefront page left
 * a customer on a bare card with no way to keep shopping except the browser
 * back button (`docs/AUDIT-2026-08-30.md` §7). A group-level boundary
 * renders inside the group's own layout, so the header and footer survive
 * and the failure stays scoped to the part that actually broke.
 *
 * Kept visually quieter than the root panel for the same reason: the rest
 * of the page is still there and still works, so this should read as "this
 * section didn't load", not "the site is down".
 */

import Link from 'next/link';
import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';

export function SegmentErrorPanel({
  digest,
  onRetry,
}: {
  readonly digest: string | undefined;
  readonly onRetry: () => void;
}) {
  return (
    <Alert severity="error" variant="outlined" sx={{ maxWidth: 640, my: 4 }}>
      <AlertTitle sx={{ fontWeight: 700 }}>{SITE.errorPageHeadingPl}</AlertTitle>
      <Stack spacing={2}>
        <Typography variant="body2">{SITE.errorPageBodyPl}</Typography>
        {digest !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {SITE.errorPageCorrelationIdLabelPl}: <code>{digest}</code> — {SITE.errorPageCorrelationIdHelpPl}
          </Typography>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button size="small" variant="contained" onClick={onRetry}>
            {SITE.errorPageRetryPl}
          </Button>
          <Button size="small" component={Link} href="/" variant="text">
            {SITE.notFoundHomeCtaPl}
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}

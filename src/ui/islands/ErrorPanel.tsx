'use client';

/**
 * The real UI behind `src/app/error.tsx` — MUI, not the hand-styled
 * `<h1>/<p>/<button>` this used to be (`docs/AUDIT-2026-08-30.md` P2-10;
 * the global error boundary was one of the last raw-HTML surfaces left, and
 * arguably the worst place for one: it is what a customer sees on the day
 * something is already going wrong).
 *
 * `'use client'` because the retry handler is a real callback and because
 * `component={Link}` needs `Link` in client scope — the same rule
 * `CartContents.tsx`'s header documents.
 *
 * The correlation id is `error.digest`, Next.js's own hash of the thrown
 * error and the same value that appears in server logs, so a customer who
 * quotes it can actually be traced to a real log line. A raw stack trace is
 * never shown (§20).
 */

import Link from 'next/link';
import { Alert, AlertTitle, Button, Paper, Stack, Typography } from '@mui/material';

import { COPY } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';

export function ErrorPanel({
  digest,
  onRetry,
}: {
  readonly digest: string | undefined;
  readonly onRetry: () => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 560, mx: 'auto', my: 8 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {SITE.errorPageHeadingPl}
          </Typography>
          <Typography color="text.secondary">{COPY.genericServerError}</Typography>
        </Stack>

        {digest !== undefined && (
          <Alert severity="info" variant="outlined">
            <AlertTitle sx={{ mb: 0.5 }}>
              {SITE.errorPageCorrelationIdLabelPl}: <code>{digest}</code>
            </AlertTitle>
            <Typography variant="body2" color="text.secondary">
              {SITE.errorPageCorrelationIdHelpPl}
            </Typography>
          </Alert>
        )}

        {/* Two ways out, not one: retrying is right when the failure was
            transient, but a customer whose retry keeps failing needs a real
            exit rather than a button that does nothing again. */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={onRetry}>
            {SITE.errorPageRetryPl}
          </Button>
          <Button component={Link} href="/" variant="outlined">
            {SITE.notFoundHomeCtaPl}
          </Button>
          <Button component={Link} href="/kontakt" variant="text">
            {SITE.notFoundContactCtaPl}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

'use client';

/**
 * Error boundary for `/panel/*` — `docs/AUDIT-2026-08-30.md` §7.
 *
 * The panel had none either, so a failed admin query dropped a staff member
 * onto the customer-styled root error page with no sidebar and no way back
 * into the panel. This keeps them inside the admin shell.
 *
 * No `ThemeRegistry` here: unlike the storefront, `panel/layout.tsx`
 * already mounts one (with the admin theme), and a route-group `error.tsx`
 * renders inside its layout — nesting a second provider would override the
 * admin theme with the storefront one on the error page only, which is
 * exactly the kind of inconsistency that makes a failure look worse than it
 * is.
 */

import { useEffect } from 'react';

import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { SITE } from '@/content/pl/site';

export default function PanelError({
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
    <Box sx={{ maxWidth: 640 }}>
      <Alert severity="error" variant="outlined">
        <AlertTitle sx={{ fontWeight: 700 }}>{SITE.errorPageHeadingPl}</AlertTitle>
        <Stack spacing={2}>
          <Typography variant="body2">{SITE.errorPageBodyPl}</Typography>
          {error.digest !== undefined && (
            <Typography variant="caption" color="text.secondary">
              {SITE.errorPageCorrelationIdLabelPl}: <code>{error.digest}</code>
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" onClick={retry}>
              {SITE.errorPageRetryPl}
            </Button>
            {/* A full document load, not `next/link`: an admin page that
                just threw is exactly where a stale client router cache is
                least trustworthy. */}
            <Button size="small" variant="text" href="/panel">
              {ADMIN.dashboardHeadingPl}
            </Button>
          </Stack>
        </Stack>
      </Alert>
    </Box>
  );
}

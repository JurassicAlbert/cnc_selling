'use client';

/**
 * The guest order-lookup form — `docs/AUDIT-2026-08-30.md` P2-10 found it
 * still rendering bare `<input>`s and a hand-styled `<button>` inside
 * `(shop)/zamowienie/sprawdz/page.tsx`.
 *
 * `'use client'` for `component={Link}` only (the same rule
 * `CartContents.tsx`'s header documents) — the form itself is still
 * zero-client-JS: a plain `<form action={lookupOrder}>` bound straight to
 * a Server Action, exactly as before. No state, no controlled inputs.
 *
 * Both fields gained real helper text. That is not decoration: an order
 * number looks like `2026/08/0042` and the access token is a long opaque
 * string from a confirmation email, and a customer who does not know that
 * has no way to guess it from an empty box.
 */

import Link from 'next/link';
import { Button, Paper, Stack, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';

export function OrderLookupForm({ action }: { readonly action: (formData: FormData) => Promise<void> }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3, maxWidth: 480 }}>
      <form action={action}>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            {SITE.orderLookupIntroPl}
          </Typography>
          <TextField
            label={SITE.orderLookupOrderNumberLabelPl}
            name="orderNumber"
            placeholder="2026/08/0042"
            helperText={SITE.orderLookupOrderNumberHelperPl}
            required
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.orderLookupTokenLabelPl}
            name="token"
            helperText={SITE.orderLookupTokenHelperPl}
            required
            size="small"
            fullWidth
          />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="submit" variant="contained">
              {SITE.orderLookupSubmitPl}
            </Button>
            {/* A logged-in customer never needs a token — their own order
                history is the shorter path, and saying so here saves them
                hunting through an email for a string they don't need. */}
            <Button component={Link} href="/moje-konto/zamowienia" variant="text" size="small">
              {SITE.orderLookupAccountAlternativePl}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
}

'use client';

/**
 * Shared review-submission form for both entry points (guest confirmation
 * page, logged-in order-history page) — the page binds the right Server
 * Action (`submitGuestReview`/`submitAccountReview`, both
 * `src/server/actions/reviews.ts`) and passes it in, so this component
 * itself never knows or cares which context it's in.
 *
 * P9 phase 9 (sitewide MUI form audit): converted from raw
 * `<input>`/`<select>`/`<button>` to real MUI — both order pages that
 * render this now also render `SupportRequestForm` (P9 phase 8) right
 * below it inside the same `ThemeRegistry`, and leaving this one raw
 * would have made the page visibly half-polished.
 */

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import type { SubmitReviewResult } from '@/server/actions/reviews';

const INITIAL_STATE: SubmitReviewResult = { ok: true };

export function ReviewForm({ action }: { readonly action: (formData: FormData) => Promise<SubmitReviewResult> }) {
  // `useActionState`'s initial state is also `{ ok: true }` — a plain
  // `submitted` flag is what actually distinguishes "hasn't been
  // submitted yet" from "just submitted successfully."
  const [submitted, setSubmitted] = useState(false);
  const [state, formAction] = useActionState(async (_prev: SubmitReviewResult, formData: FormData) => {
    const result = await action(formData);
    if (result.ok) {
      setSubmitted(true);
    }
    return result;
  }, INITIAL_STATE);

  if (submitted) {
    return <Alert severity="success">{SITE.reviewFormThankYouPl}</Alert>;
  }

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 480, mt: 2 }}>
        <Typography variant="h6">{SITE.reviewFormHeadingPl}</Typography>

        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={SITE.reviewFormAuthorNameLabelPl} name="authorNamePl" required size="small" fullWidth />

        <TextField select label={SITE.reviewFormRatingLabelPl} name="rating" defaultValue="5" size="small" sx={{ maxWidth: 160 }}>
          {[5, 4, 3, 2, 1].map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>

        <TextField label={SITE.reviewFormBodyLabelPl} name="bodyPl" required multiline minRows={4} size="small" fullWidth />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.reviewFormSubmitPl}
    </Button>
  );
}

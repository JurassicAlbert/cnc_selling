'use client';

/**
 * Shared support/contact form — same "page binds the right Server Action,
 * this component never knows which context it's in" shape as
 * `ReviewForm.tsx`, but built in real MUI from the start (this is a brand
 * new form, not an existing raw one — no reason to add another form
 * Phase 9's sitewide audit would just have to convert later).
 * `ThemeRegistry` is mounted by each page that renders this, same
 * "mount around just the real interactive island" precedent as checkout/
 * the saved-designs page.
 */

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import type { SubmitSupportRequestResult } from '@/server/actions/support-requests';

const INITIAL_STATE: SubmitSupportRequestResult = { ok: true };

export function SupportRequestForm({
  action,
  heading,
  intro,
  defaultEmail,
}: {
  readonly action: (formData: FormData) => Promise<SubmitSupportRequestResult>;
  readonly heading?: string;
  readonly intro?: string;
  readonly defaultEmail?: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [state, formAction] = useActionState(async (_prev: SubmitSupportRequestResult, formData: FormData) => {
    const result = await action(formData);
    if (result.ok) {
      setSubmitted(true);
    }
    return result;
  }, INITIAL_STATE);

  if (submitted) {
    return <Alert severity="success">{SITE.contactFormThankYouPl}</Alert>;
  }

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        {heading !== undefined && <Typography variant="h6">{heading}</Typography>}
        {intro !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {intro}
          </Typography>
        )}

        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={SITE.contactFormEmailLabelPl} name="email" type="email" defaultValue={defaultEmail} required size="small" fullWidth />
        <TextField label={SITE.contactFormNameLabelPl} name="namePl" size="small" fullWidth />
        <TextField label={SITE.contactFormSubjectLabelPl} name="subjectPl" required size="small" fullWidth />
        <TextField label={SITE.contactFormMessageLabelPl} name="messagePl" required multiline minRows={4} size="small" fullWidth />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.contactFormSubmitPl}
    </Button>
  );
}

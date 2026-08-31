'use client';

/** Registration — same shape as `LoginForm.tsx`. P9 phase 9: converted to real MUI, same reasoning. */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { authFormErrorMessage, authIssueMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitRegister } from '@/server/actions/auth';
import type { RegisterFormState } from '@/server/actions/auth';

const INITIAL_STATE: RegisterFormState = { fieldErrors: {}, formError: null, retryAfterSeconds: null, values: {} };

export function RegisterForm() {
  const [state, formAction] = useActionState(submitRegister, INITIAL_STATE);
  const [renderKey, setRenderKey] = useState(0);
  const isFirstRender = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately keyed on state's reference identity, not its contents
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setRenderKey((key) => key + 1);
  }, [state]);

  return (
    <form key={renderKey} action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 400 }}>
        {state.formError !== null && <Alert severity="error">{authFormErrorMessage(state.formError, state.retryAfterSeconds)}</Alert>}

        <TextField
          label={SITE.authNameLabelPl}
          name="name"
          defaultValue={state.values.name}
          error={state.fieldErrors.name !== undefined}
          helperText={state.fieldErrors.name !== undefined ? authIssueMessage(state.fieldErrors.name) : undefined}
          size="small"
          fullWidth
        />
        <TextField
          label={SITE.authEmailLabelPl}
          name="email"
          type="email"
          defaultValue={state.values.email}
          error={state.fieldErrors.email !== undefined}
          helperText={state.fieldErrors.email !== undefined ? authIssueMessage(state.fieldErrors.email) : undefined}
          size="small"
          fullWidth
        />
        <TextField
          label={SITE.authPasswordLabelPl}
          name="password"
          type="password"
          error={state.fieldErrors.password !== undefined}
          helperText={state.fieldErrors.password !== undefined ? authIssueMessage(state.fieldErrors.password) : undefined}
          size="small"
          fullWidth
        />

        <SubmitButton />

        <Typography variant="body2">
          {SITE.authHaveAccountPl} <Link href="/logowanie">{SITE.authSwitchToLoginPl}</Link>
        </Typography>
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.authRegisterSubmitPl}
    </Button>
  );
}

'use client';

/**
 * Password login — same `useActionState`/`renderKey` shape as
 * `CheckoutForm.tsx` (see that file's header for why: `defaultValue`-based
 * uncontrolled inputs only apply on first mount, so a validation error
 * needs the form to remount to show the server's echoed-back values).
 *
 * P9 phase 9 (sitewide MUI form audit, closing pass): converted from raw
 * `<input>`/`<button>` to real MUI — `ThemeRegistry` now mounted on
 * `/logowanie`, same "mount around just the real interactive island"
 * precedent every earlier phase this session already established.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { authFormErrorMessage, authIssueMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitLogin } from '@/server/actions/auth';
import type { LoginFormState } from '@/server/actions/auth';

const INITIAL_STATE: LoginFormState = { fieldErrors: {}, formError: null, values: {} };

export function LoginForm() {
  const [state, formAction] = useActionState(submitLogin, INITIAL_STATE);
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
        {state.formError !== null && <Alert severity="error">{authFormErrorMessage(state.formError)}</Alert>}

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
          {SITE.authNoAccountPl} <Link href="/rejestracja">{SITE.authSwitchToRegisterPl}</Link>
        </Typography>
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.authLoginSubmitPl}
    </Button>
  );
}

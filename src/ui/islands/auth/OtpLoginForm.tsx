'use client';

/**
 * Passwordless login — the "magic-link-equivalent" path
 * `docs/HANDOVER.md`'s P6 section describes: `submitOtpRequest` sends a
 * code by email (Better Auth's `emailOTP` plugin, via `mailer.ts`),
 * `submitOtpLogin` verifies it and signs in. Two separate `useActionState`
 * hooks, switched between by one small piece of local state (`state.sent`
 * from the first action) — the code-entry step only ever shows once a
 * request has actually gone out.
 *
 * P9 phase 9: converted to real MUI, same reasoning as `LoginForm.tsx`.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { authFormErrorMessage, authIssueMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitOtpLogin, submitOtpRequest } from '@/server/actions/auth';
import type { OtpLoginFormState, OtpRequestFormState } from '@/server/actions/auth';

const INITIAL_REQUEST_STATE: OtpRequestFormState = { fieldErrors: {}, formError: null, retryAfterSeconds: null, values: {}, sent: false };
const INITIAL_LOGIN_STATE: OtpLoginFormState = { fieldErrors: {}, formError: null, values: {} };

export function OtpLoginForm() {
  const [requestState, requestAction] = useActionState(submitOtpRequest, INITIAL_REQUEST_STATE);

  if (!requestState.sent) {
    return <OtpRequestStep state={requestState} formAction={requestAction} />;
  }
  return <OtpCodeStep email={requestState.values.email ?? ''} />;
}

function OtpRequestStep({
  state,
  formAction,
}: {
  readonly state: OtpRequestFormState;
  readonly formAction: (formData: FormData) => void;
}) {
  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 400 }}>
        {state.formError !== null && (
          <Alert severity="error">{authFormErrorMessage(state.formError, state.retryAfterSeconds)}</Alert>
        )}
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
        <SubmitButton label={SITE.authOtpRequestSubmitPl} />
      </Stack>
    </form>
  );
}

function OtpCodeStep({ email }: { readonly email: string }) {
  const [state, formAction] = useActionState(submitOtpLogin, { ...INITIAL_LOGIN_STATE, values: { email } });
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
        <Alert severity="info">{SITE.authOtpSentNoticePl}</Alert>
        {state.formError !== null && <Alert severity="error">{authFormErrorMessage(state.formError)}</Alert>}
        <input type="hidden" name="email" value={email} />
        <TextField
          label={SITE.authOtpCodeLabelPl}
          name="otp"
          error={state.fieldErrors.otp !== undefined}
          helperText={state.fieldErrors.otp !== undefined ? authIssueMessage(state.fieldErrors.otp) : undefined}
          size="small"
          fullWidth
        />
        <SubmitButton label={SITE.authOtpSubmitPl} />
      </Stack>
    </form>
  );
}

function SubmitButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {label}
    </Button>
  );
}

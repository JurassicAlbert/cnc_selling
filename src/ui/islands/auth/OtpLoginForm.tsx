'use client';

/**
 * Passwordless login — the "magic-link-equivalent" path
 * `docs/HANDOVER.md`'s P6 section describes: `submitOtpRequest` sends a
 * code by email (Better Auth's `emailOTP` plugin, via `mailer.ts`),
 * `submitOtpLogin` verifies it and signs in. Two separate `useActionState`
 * hooks, switched between by one small piece of local state (`state.sent`
 * from the first action) — the code-entry step only ever shows once a
 * request has actually gone out.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import type { AuthFieldIssueCode } from '@/content/pl/messages';
import { authFormErrorMessage, authIssueMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitOtpLogin, submitOtpRequest } from '@/server/actions/auth';
import type { OtpLoginFormState, OtpRequestFormState } from '@/server/actions/auth';

const INITIAL_REQUEST_STATE: OtpRequestFormState = { fieldErrors: {}, formError: null, values: {}, sent: false };
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
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      {state.formError !== null && (
        <p style={{ color: 'var(--mui-palette-primary-main)' }}>{authFormErrorMessage(state.formError)}</p>
      )}
      <Field
        label={SITE.authEmailLabelPl}
        name="email"
        type="email"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
      />
      <SubmitButton label={SITE.authOtpRequestSubmitPl} />
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
    <form key={renderKey} action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      <p>{SITE.authOtpSentNoticePl}</p>
      {state.formError !== null && (
        <p style={{ color: 'var(--mui-palette-primary-main)' }}>{authFormErrorMessage(state.formError)}</p>
      )}
      <input type="hidden" name="email" value={email} />
      <Field label={SITE.authOtpCodeLabelPl} name="otp" error={state.fieldErrors.otp} />
      <SubmitButton label={SITE.authOtpSubmitPl} />
    </form>
  );
}

function SubmitButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        font: 'var(--mui-font-button)',
        padding: '12px 24px',
        background: 'var(--mui-palette-primary-main)',
        color: 'var(--mui-palette-background-paper)',
        border: 'none',
        borderRadius: 2,
      }}
    >
      {label}
    </button>
  );
}

function ErrorText({ code }: { readonly code: AuthFieldIssueCode }) {
  return <p style={{ color: 'var(--mui-palette-primary-main)', margin: '4px 0 0' }}>{authIssueMessage(code)}</p>;
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  error,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly defaultValue?: string;
  readonly error?: AuthFieldIssueCode;
}) {
  return (
    <div>
      <label style={{ display: 'block' }}>
        {label}
        <input type={type} name={name} defaultValue={defaultValue} style={{ display: 'block', width: '100%' }} />
      </label>
      {error !== undefined && <ErrorText code={error} />}
    </div>
  );
}

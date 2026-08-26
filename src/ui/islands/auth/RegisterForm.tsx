'use client';

/** Registration — same shape as `LoginForm.tsx`. */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

import type { AuthFieldIssueCode } from '@/content/pl/messages';
import { authFormErrorMessage, authIssueMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitRegister } from '@/server/actions/auth';
import type { RegisterFormState } from '@/server/actions/auth';

const INITIAL_STATE: RegisterFormState = { fieldErrors: {}, formError: null, values: {} };

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
    <form key={renderKey} action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      {state.formError !== null && (
        <p style={{ color: 'var(--mui-palette-primary-main)' }}>{authFormErrorMessage(state.formError)}</p>
      )}

      <Field
        label={SITE.authNameLabelPl}
        name="name"
        defaultValue={state.values.name}
        error={state.fieldErrors.name}
      />
      <Field
        label={SITE.authEmailLabelPl}
        name="email"
        type="email"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
      />
      <Field label={SITE.authPasswordLabelPl} name="password" type="password" error={state.fieldErrors.password} />

      <SubmitButton />

      <p style={{ font: 'var(--mui-font-body2)' }}>
        {SITE.authHaveAccountPl} <Link href="/logowanie">{SITE.authSwitchToLoginPl}</Link>
      </p>
    </form>
  );
}

function SubmitButton() {
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
      {SITE.authRegisterSubmitPl}
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

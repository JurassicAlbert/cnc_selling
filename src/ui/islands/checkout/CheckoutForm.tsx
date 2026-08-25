'use client';

/**
 * The first `<form action={...}>` + `useActionState` pattern in this
 * codebase — chosen deliberately over a fully client-controlled form.
 * Checkout has no need for the configurator's live-reactive pricing (the
 * price shown here is already the cart's cached value); it just needs real
 * server-validated submission with inline field errors, which
 * `useActionState` gives for the cost of one small client island instead
 * of a page's worth of controlled-input state — the same minimal-client-JS
 * discipline as `CategoryFilterForm` and the cart page's own per-row forms.
 *
 * One real bug found and fixed browser-testing this: `useActionState`
 * re-renders the SAME form instance on every submission, and every input
 * here is uncontrolled (`defaultValue`, never `value`) — so a validation
 * error on one field silently erased everything else the customer had
 * typed, since `defaultValue` only ever applies on a component's initial
 * mount, never on a later re-render. `renderKey` forces every field to
 * remount after each submission specifically so the server's echoed-back
 * `state.values` actually shows up.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { checkoutIssueMessage } from '@/content/pl/messages';
import type { CheckoutFieldIssueCode } from '@/content/pl/messages';
import { COPY } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { submitCheckout } from '@/server/actions/checkout';
import type { CheckoutFormState } from '@/server/actions/checkout';

// Not exported from checkout.ts itself: a 'use server' file may only
// export async functions, never a plain data constant.
const INITIAL_CHECKOUT_STATE: CheckoutFormState = { fieldErrors: {}, formError: null, values: {} };

export function CheckoutForm() {
  const [state, formAction] = useActionState(submitCheckout, INITIAL_CHECKOUT_STATE);
  const [renderKey, setRenderKey] = useState(0);
  const isFirstRender = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately keyed on state's reference identity (any new object from useActionState), not its contents
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setRenderKey((key) => key + 1);
  }, [state]);

  const v = state.values;

  return (
    <form
      key={renderKey}
      action={formAction}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}
    >
      {state.formError === 'CART_EMPTY' && (
        <p style={{ color: 'var(--mui-palette-primary-main)' }}>{SITE.checkoutEmptyCartRedirectPl}</p>
      )}
      {state.formError === 'PRICE_CHANGED' && (
        <p style={{ color: 'var(--mui-palette-primary-main)' }}>{COPY.priceChanged}</p>
      )}

      <fieldset style={{ border: '1px solid var(--mui-palette-divider)', padding: 16 }}>
        <legend>{SITE.checkoutBuyerSectionHeadingPl}</legend>
        <Field
          label={SITE.checkoutEmailLabelPl}
          name="email"
          type="email"
          defaultValue={v.email}
          error={state.fieldErrors.email}
        />
        <Field
          label={SITE.checkoutPhoneLabelPl}
          name="phone"
          type="tel"
          defaultValue={v.phone}
          error={state.fieldErrors.phone}
        />
        <Field
          label={SITE.checkoutFirstNameLabelPl}
          name="firstName"
          defaultValue={v.firstName}
          error={state.fieldErrors.firstName}
        />
        <Field
          label={SITE.checkoutLastNameLabelPl}
          name="lastName"
          defaultValue={v.lastName}
          error={state.fieldErrors.lastName}
        />
      </fieldset>

      <fieldset style={{ border: '1px solid var(--mui-palette-divider)', padding: 16 }}>
        <legend>{SITE.checkoutInvoiceSectionHeadingPl}</legend>
        <Field label={SITE.checkoutCompanyNameLabelPl} name="companyName" defaultValue={v.companyName} />
        <Field
          label={SITE.checkoutNipLabelPl}
          name="nip"
          defaultValue={v.nip}
          error={state.fieldErrors.nip}
        />
      </fieldset>

      <fieldset style={{ border: '1px solid var(--mui-palette-divider)', padding: 16 }}>
        <legend>{SITE.checkoutAddressSectionHeadingPl}</legend>
        <Field
          label={SITE.checkoutStreetLabelPl}
          name="street"
          defaultValue={v.street}
          error={state.fieldErrors.street}
        />
        <Field
          label={SITE.checkoutPostalCodeLabelPl}
          name="postalCode"
          placeholder="00-001"
          defaultValue={v.postalCode}
          error={state.fieldErrors.postalCode}
        />
        <Field
          label={SITE.checkoutCityLabelPl}
          name="city"
          defaultValue={v.city}
          error={state.fieldErrors.city}
        />
      </fieldset>

      <fieldset style={{ border: '1px solid var(--mui-palette-divider)', padding: 16 }}>
        <legend>{SITE.checkoutPaymentSectionHeadingPl}</legend>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="paymentMethod"
            value="BANK_TRANSFER"
            defaultChecked={v.paymentMethod === undefined || v.paymentMethod === 'BANK_TRANSFER'}
          />{' '}
          {SITE.checkoutPaymentBankTransferPl}
        </label>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="paymentMethod"
            value="CONTACT_ARRANGED"
            defaultChecked={v.paymentMethod === 'CONTACT_ARRANGED'}
          />{' '}
          {SITE.checkoutPaymentContactArrangedPl}
        </label>
        {state.fieldErrors.paymentMethod !== undefined && (
          <ErrorText code={state.fieldErrors.paymentMethod} />
        )}
      </fieldset>

      <div>
        <label style={{ display: 'block' }}>
          <input type="checkbox" name="termsAccepted" /> {SITE.checkoutTermsLabelPl}
        </label>
        {state.fieldErrors.terms !== undefined && <ErrorText code={state.fieldErrors.terms} />}
      </div>

      <div>
        <label style={{ display: 'block' }}>
          <input type="checkbox" name="withdrawalAcknowledged" /> {SITE.checkoutWithdrawalExemptionTextPl}
        </label>
        {state.fieldErrors.withdrawal !== undefined && <ErrorText code={state.fieldErrors.withdrawal} />}
      </div>

      <SubmitButton />
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
      {SITE.checkoutSubmitPl}
    </button>
  );
}

function ErrorText({ code }: { readonly code: CheckoutFieldIssueCode }) {
  return <p style={{ color: 'var(--mui-palette-primary-main)', margin: '4px 0 0' }}>{checkoutIssueMessage(code)}</p>;
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  defaultValue,
  error,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly error?: CheckoutFieldIssueCode;
}) {
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <label style={{ display: 'block' }}>
        {label}
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {error !== undefined && <ErrorText code={error} />}
    </div>
  );
}

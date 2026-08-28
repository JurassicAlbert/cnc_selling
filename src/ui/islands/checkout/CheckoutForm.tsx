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
 *
 * P9 phase 5: converted from raw `<input>`/`<fieldset>` to real MUI —
 * `ThemeRegistry` now mounted around this island from the checkout page,
 * same "mount where warranted" precedent the product page's Configurator
 * already set (`ThemeRegistry` stays off the root layout for measured
 * mobile-LCP reasons). Also gained a real delivery-method selector, DB-
 * driven (`ActiveDeliveryMethod[]`) — the shown price is for display only;
 * `createOrder` always recomputes it server-side from the real row, never
 * trusting whatever this form last rendered (§15.3).
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { checkoutIssueMessage } from '@/content/pl/messages';
import { COPY } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { formatPln } from '@/domain/money/money';
import { submitCheckout } from '@/server/actions/checkout';
import type { CheckoutFormState } from '@/server/actions/checkout';
import { computeShippingGrosze } from '@/domain/checkout/delivery';
import type { ActiveDeliveryMethod } from '@/server/repositories/delivery-methods';

// Not exported from checkout.ts itself: a 'use server' file may only
// export async functions, never a plain data constant.
const INITIAL_CHECKOUT_STATE: CheckoutFormState = { fieldErrors: {}, formError: null, values: {} };

export function CheckoutForm({
  deliveryMethods,
  subtotalGrossGrosze,
}: {
  readonly deliveryMethods: readonly ActiveDeliveryMethod[];
  /** Pre-shipping gross total, for the live estimate shown below — `createOrder` always recomputes the real, final figure server-side (§15.3); this is display-only. */
  readonly subtotalGrossGrosze: number;
}) {
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
  const defaultDeliveryMethodId = v.deliveryMethodId ?? deliveryMethods[0]?.id ?? '';
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(defaultDeliveryMethodId);
  const selectedDelivery = deliveryMethods.find((m) => m.id === selectedDeliveryId) ?? null;

  return (
    <form key={renderKey} action={formAction}>
      <Stack spacing={4} sx={{ maxWidth: 560 }}>
        {state.formError === 'CART_EMPTY' && <Alert severity="error">{SITE.checkoutEmptyCartRedirectPl}</Alert>}
        {state.formError === 'PRICE_CHANGED' && <Alert severity="error">{COPY.priceChanged}</Alert>}
        {state.formError === 'DELIVERY_METHOD_INVALID' && <Alert severity="error">{SITE.checkoutDeliveryMethodInvalidPl}</Alert>}

        <Stack spacing={2}>
          <Typography variant="subtitle1">{SITE.checkoutBuyerSectionHeadingPl}</Typography>
          <TextField
            label={SITE.checkoutEmailLabelPl}
            name="email"
            type="email"
            defaultValue={v.email}
            error={state.fieldErrors.email !== undefined}
            helperText={state.fieldErrors.email !== undefined ? checkoutIssueMessage(state.fieldErrors.email) : undefined}
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.checkoutPhoneLabelPl}
            name="phone"
            type="tel"
            defaultValue={v.phone}
            error={state.fieldErrors.phone !== undefined}
            helperText={state.fieldErrors.phone !== undefined ? checkoutIssueMessage(state.fieldErrors.phone) : undefined}
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.checkoutFirstNameLabelPl}
            name="firstName"
            defaultValue={v.firstName}
            error={state.fieldErrors.firstName !== undefined}
            helperText={state.fieldErrors.firstName !== undefined ? checkoutIssueMessage(state.fieldErrors.firstName) : undefined}
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.checkoutLastNameLabelPl}
            name="lastName"
            defaultValue={v.lastName}
            error={state.fieldErrors.lastName !== undefined}
            helperText={state.fieldErrors.lastName !== undefined ? checkoutIssueMessage(state.fieldErrors.lastName) : undefined}
            size="small"
            fullWidth
          />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="subtitle1">{SITE.checkoutInvoiceSectionHeadingPl}</Typography>
          <TextField label={SITE.checkoutCompanyNameLabelPl} name="companyName" defaultValue={v.companyName} size="small" fullWidth />
          <TextField
            label={SITE.checkoutNipLabelPl}
            name="nip"
            defaultValue={v.nip}
            error={state.fieldErrors.nip !== undefined}
            helperText={state.fieldErrors.nip !== undefined ? checkoutIssueMessage(state.fieldErrors.nip) : undefined}
            size="small"
            fullWidth
          />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="subtitle1">{SITE.checkoutAddressSectionHeadingPl}</Typography>
          <TextField
            label={SITE.checkoutStreetLabelPl}
            name="street"
            defaultValue={v.street}
            error={state.fieldErrors.street !== undefined}
            helperText={state.fieldErrors.street !== undefined ? checkoutIssueMessage(state.fieldErrors.street) : undefined}
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.checkoutPostalCodeLabelPl}
            name="postalCode"
            placeholder="00-001"
            defaultValue={v.postalCode}
            error={state.fieldErrors.postalCode !== undefined}
            helperText={state.fieldErrors.postalCode !== undefined ? checkoutIssueMessage(state.fieldErrors.postalCode) : undefined}
            size="small"
            fullWidth
          />
          <TextField
            label={SITE.checkoutCityLabelPl}
            name="city"
            defaultValue={v.city}
            error={state.fieldErrors.city !== undefined}
            helperText={state.fieldErrors.city !== undefined ? checkoutIssueMessage(state.fieldErrors.city) : undefined}
            size="small"
            fullWidth
          />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle1">{SITE.checkoutDeliverySectionHeadingPl}</Typography>
          {deliveryMethods.length === 0 ? (
            <Alert severity="warning">{SITE.checkoutNoDeliveryMethodsPl}</Alert>
          ) : (
            <RadioGroup name="deliveryMethodId" value={selectedDeliveryId} onChange={(e) => setSelectedDeliveryId(e.target.value)}>
              {deliveryMethods.map((method) => (
                <Paper key={method.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                  <FormControlLabel
                    value={method.id}
                    control={<Radio size="small" />}
                    sx={{ alignItems: 'flex-start', width: '100%', m: 0 }}
                    label={
                      <Stack sx={{ pt: 0.25 }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {method.namePl}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {formatPln(method.priceGrosze)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {method.descPl}
                        </Typography>
                      </Stack>
                    }
                  />
                </Paper>
              ))}
            </RadioGroup>
          )}
          {selectedDelivery !== null && (
            <Typography variant="caption" color="text.secondary">
              {SITE.checkoutDeliveryEstimateLabelPl} {selectedDelivery.estimatedDaysMin}–{selectedDelivery.estimatedDaysMax}{' '}
              {SITE.checkoutDeliveryEstimateUnitPl}
            </Typography>
          )}
          {state.fieldErrors.deliveryMethodId !== undefined && (
            <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.deliveryMethodId)}</FormHelperText>
          )}
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle1">{SITE.checkoutPaymentSectionHeadingPl}</Typography>
          <RadioGroup name="paymentMethod" defaultValue={v.paymentMethod ?? 'BANK_TRANSFER'}>
            <FormControlLabel value="BANK_TRANSFER" control={<Radio size="small" />} label={SITE.checkoutPaymentBankTransferPl} />
            <FormControlLabel value="CONTACT_ARRANGED" control={<Radio size="small" />} label={SITE.checkoutPaymentContactArrangedPl} />
          </RadioGroup>
          {state.fieldErrors.paymentMethod !== undefined && (
            <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.paymentMethod)}</FormHelperText>
          )}
        </Stack>

        <Stack spacing={1}>
          <FormControlLabel control={<Checkbox name="termsAccepted" size="small" />} label={SITE.checkoutTermsLabelPl} />
          {state.fieldErrors.terms !== undefined && <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.terms)}</FormHelperText>}

          <FormControlLabel control={<Checkbox name="withdrawalAcknowledged" size="small" />} label={SITE.checkoutWithdrawalExemptionTextPl} />
          {state.fieldErrors.withdrawal !== undefined && <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.withdrawal)}</FormHelperText>}
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={0.5}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {SITE.checkoutSubtotalLabelPl}
              </Typography>
              <Typography variant="body2">{formatPln(subtotalGrossGrosze)}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {SITE.checkoutShippingLabelPl}
              </Typography>
              <Typography variant="body2">
                {selectedDelivery !== null ? formatPln(computeShippingGrosze(selectedDelivery, subtotalGrossGrosze)) : '—'}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 0.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1">{SITE.orderTotalLabelPl}</Typography>
              <Typography variant="subtitle1">
                {formatPln(subtotalGrossGrosze + (selectedDelivery !== null ? computeShippingGrosze(selectedDelivery, subtotalGrossGrosze) : 0))}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" size="large" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.checkoutSubmitPl}
    </Button>
  );
}

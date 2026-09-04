'use client';

/**
 * The first `<form action={...}>` + `useActionState` pattern in this
 * codebase - chosen deliberately over a fully client-controlled form.
 * Checkout has no need for the configurator's live-reactive pricing (the
 * price shown here is already the cart's cached value); it just needs real
 * server-validated submission with inline field errors, which
 * `useActionState` gives for the cost of one small client island instead
 * of a page's worth of controlled-input state - the same minimal-client-JS
 * discipline as `CategoryFilterForm` and the cart page's own per-row forms.
 *
 * One real bug found and fixed browser-testing this: `useActionState`
 * re-renders the SAME form instance on every submission, and every input
 * here is uncontrolled (`defaultValue`, never `value`) - so a validation
 * error on one field silently erased everything else the customer had
 * typed, since `defaultValue` only ever applies on a component's initial
 * mount, never on a later re-render. `renderKey` forces every field to
 * remount after each submission specifically so the server's echoed-back
 * `state.values` actually shows up.
 *
 * 2026-08-29 rewrite, owner feedback: "Formularz zamówienia również ma
 * bardzo biedne UI/UX" - a real two-column layout (form left, sticky
 * order-summary card right on desktop), section icons, and every method's
 * price now REAL and pre-computed server-side (`ActiveDeliveryMethod` -
 * see `server/repositories/delivery-methods.ts`'s `resolveDeliveryMethodsForCart`)
 * rather than derived client-side from a flat rate - this component no
 * longer imports or calls anything from `domain/checkout/delivery.ts`. An
 * infeasible method (too heavy, or a real item too large for a locker) is
 * shown disabled with its real reason, never silently hidden. Phone is now
 * required, and delivery gained two real, separate note fields (FOR the
 * courier vs FOR us) - the owner's own "shipping form" restructure
 * request. The pickup-point picker is carrier-scoped to whichever method
 * is selected (`searchPickupPoints(carrier, query)`) and says outright
 * that its list is a preliminary sample, not a live directory - see that
 * file's own header comment for why (a real InPost/DPD account is needed
 * for a live one).
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  FormHelperText,
  Grid,
  List,
  ListItemButton,
  ListItemText,
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
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { submitCheckout } from '@/server/actions/checkout';
import type { CheckoutFormState } from '@/server/actions/checkout';
import type { CartView } from '@/server/repositories/cart';
import type { CheckoutPrefill } from '@/server/repositories/checkout-prefill';
import type { ActiveDeliveryMethod } from '@/server/repositories/delivery-methods';
import type { ActivePaymentMethod } from '@/server/repositories/payment-methods';
// A plain-data module (no `prisma`/Node-only imports) - safe to import as a
// real value here, unlike `delivery-methods.ts`'s own type-only import
// above (see that file's comment on why THAT one can't cross this boundary).
import { findPickupPointById, searchPickupPoints } from '@/server/delivery/pickup-points';

// Not exported from checkout.ts itself: a 'use server' file may only
// export async functions, never a plain data constant.
const INITIAL_CHECKOUT_STATE: CheckoutFormState = { fieldErrors: {}, formError: null, values: {} };

/**
 * The values a field should start with.
 *
 * Three sources, in this order. A failed submission's own values win,
 * because they are the most recent thing the customer typed and losing them
 * to a prefill would be worse than not offering one. Then whatever
 * „Uzupełnij moimi danymi" put there. Then nothing.
 *
 * Every field here is uncontrolled (`defaultValue`), so this only ever seeds
 * a render - which is why applying the prefill bumps `renderKey` and remounts
 * the form rather than trying to write into the inputs.
 */
function fieldValue(
  state: CheckoutFormState,
  prefill: CheckoutPrefill | null,
  field: keyof CheckoutPrefill,
): string | undefined {
  const submitted = state.values[field as keyof CheckoutFormState['values']];
  if (typeof submitted === 'string' && submitted.length > 0) {
    return submitted;
  }
  const offered = prefill === null ? '' : String(prefill[field] ?? '');
  return offered.length > 0 ? offered : undefined;
}

export function CheckoutForm({
  cart,
  prefill,
  deliveryMethods,
  paymentMethods,
  idempotencyKey,
}: {
  readonly cart: CartView;
  /**
   * The buyer details this shop can honestly offer to fill in, or `null` for
   * a guest. Resolved server-side (`getCheckoutPrefill`) rather than here:
   * it reads the account and the customer's most recent order, and neither
   * belongs in a client bundle.
   */
  readonly prefill: CheckoutPrefill | null;
  readonly deliveryMethods: readonly ActiveDeliveryMethod[];
  readonly paymentMethods: readonly ActivePaymentMethod[];
  /** This form's own submission id, minted once per page render - see the page's own comment and `docs/AUDIT-2026-08-30.md` P0-2. */
  readonly idempotencyKey: string;
}) {
  const [state, formAction] = useActionState(submitCheckout, INITIAL_CHECKOUT_STATE);
  const [prefillApplied, setPrefillApplied] = useState(false);
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

  // `v` was `state.values` directly. It now folds in the prefill, so one
  // helper answers "what should this box start with" for every field.
  const applied = prefillApplied ? prefill : null;
  const v = {
    email: fieldValue(state, applied, 'email'),
    phone: fieldValue(state, applied, 'phone'),
    firstName: fieldValue(state, applied, 'firstName'),
    lastName: fieldValue(state, applied, 'lastName'),
    companyName: fieldValue(state, applied, 'companyName'),
    nip: fieldValue(state, applied, 'nip'),
    street: fieldValue(state, applied, 'street'),
    postalCode: fieldValue(state, applied, 'postalCode'),
    city: fieldValue(state, applied, 'city'),
    // Not part of the prefill: a courier note is about this delivery, not
    // about the customer, and carrying the last one forward would put a
    // stale instruction on a new parcel.
    courierNotePl: state.values.courierNotePl,
    internalShipmentNotePl: state.values.internalShipmentNotePl,
    deliveryMethodId: state.values.deliveryMethodId,
    paymentMethodConfigId: state.values.paymentMethodConfigId,
    pickupPointId: state.values.pickupPointId,
  };
  const firstFeasibleId = deliveryMethods.find((m) => m.feasible)?.id ?? deliveryMethods[0]?.id ?? '';
  const defaultDeliveryMethodId = v.deliveryMethodId ?? firstFeasibleId;
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(defaultDeliveryMethodId);
  const selectedDelivery = deliveryMethods.find((m) => m.id === selectedDeliveryId) ?? null;
  const defaultPaymentMethodConfigId = v.paymentMethodConfigId ?? paymentMethods[0]?.id ?? '';

  const [pickupPointQuery, setPickupPointQuery] = useState('');
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(v.pickupPointId ?? null);
  const pickupCarrier = selectedDelivery?.carrier ?? null;
  const pickupPointMatches = useMemo(
    () => (pickupCarrier !== null ? searchPickupPoints(pickupCarrier, pickupPointQuery) : []),
    [pickupCarrier, pickupPointQuery],
  );
  const selectedPickupPoint =
    selectedPickupPointId !== null && pickupCarrier !== null ? findPickupPointById(pickupCarrier, selectedPickupPointId) : null;

  const shippingGrosze = selectedDelivery?.feasible === true ? selectedDelivery.priceGrosze : null;
  const totalGrossGrosze = shippingGrosze !== null ? cart.subtotalGrossGrosze + shippingGrosze : null;
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <form key={renderKey} action={formAction}>
      {/* Deliberately OUTSIDE the `renderKey` remount concern: its value comes
          from a prop, so it survives every re-render of this form and every
          failed submission - which is exactly what makes a retry dedupe. */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={4}>
            {state.formError === 'CART_EMPTY' && <Alert severity="error">{SITE.checkoutEmptyCartRedirectPl}</Alert>}
            {state.formError === 'CART_CHANGED' && <Alert severity="warning">{SITE.checkoutCartChangedPl}</Alert>}
            {state.formError === 'PRICE_CHANGED' && <Alert severity="error">{COPY.priceChanged}</Alert>}
            {state.formError === 'DELIVERY_METHOD_INVALID' && <Alert severity="error">{SITE.checkoutDeliveryMethodInvalidPl}</Alert>}
            {state.formError === 'PAYMENT_METHOD_INVALID' && <Alert severity="error">{SITE.checkoutPaymentMethodInvalidPl}</Alert>}
            {state.formError === 'PICKUP_POINT_INVALID' && <Alert severity="error">{SITE.checkoutPickupPointInvalidPl}</Alert>}
            {state.formError === 'RATE_LIMITED' && <Alert severity="warning">{SITE.checkoutRateLimitedPl}</Alert>}
            {state.formError === 'OPTION_UNAVAILABLE' && (
              <Alert severity="warning">{SITE.checkoutOptionUnavailablePl}</Alert>
            )}

            {/*
              Owner request, 2026-09-04: offer to fill this in from the
              account when someone is signed in, and point a guest at
              registration rather than making them type everything by hand.

              Above the fields rather than beside them, because it is only
              useful before anyone starts typing - and it never overwrites
              what they have already entered (`fieldValue` puts a submitted
              value ahead of the prefill).
            */}
            {prefill !== null ? (
              <PrefillPanel
                prefill={prefill}
                applied={prefillApplied}
                onApply={() => {
                  setPrefillApplied(true);
                  // Every field is uncontrolled, so a new default only takes
                  // effect on a fresh mount. This is the same `renderKey` the
                  // form already uses after a failed submission.
                  setRenderKey((key) => key + 1);
                }}
              />
            ) : (
              <GuestAccountPanel />
            )}

            <SectionCard heading={SITE.checkoutBuyerSectionHeadingPl}>
              <TextField
                label={SITE.checkoutEmailLabelPl}
                name="email"
                type="email"
                required
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
                required
                defaultValue={v.phone}
                error={state.fieldErrors.phone !== undefined}
                helperText={state.fieldErrors.phone !== undefined ? checkoutIssueMessage(state.fieldErrors.phone) : undefined}
                size="small"
                fullWidth
              />
              <TextField
                label={SITE.checkoutFirstNameLabelPl}
                name="firstName"
                required
                defaultValue={v.firstName}
                error={state.fieldErrors.firstName !== undefined}
                helperText={state.fieldErrors.firstName !== undefined ? checkoutIssueMessage(state.fieldErrors.firstName) : undefined}
                size="small"
                fullWidth
              />
              <TextField
                label={SITE.checkoutLastNameLabelPl}
                name="lastName"
                required
                defaultValue={v.lastName}
                error={state.fieldErrors.lastName !== undefined}
                helperText={state.fieldErrors.lastName !== undefined ? checkoutIssueMessage(state.fieldErrors.lastName) : undefined}
                size="small"
                fullWidth
              />
            </SectionCard>

            <SectionCard heading={SITE.checkoutInvoiceSectionHeadingPl}>
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
            </SectionCard>

            <SectionCard heading={SITE.checkoutAddressSectionHeadingPl}>
              <TextField
                label={SITE.checkoutStreetLabelPl}
                name="street"
                required
                defaultValue={v.street}
                error={state.fieldErrors.street !== undefined}
                helperText={state.fieldErrors.street !== undefined ? checkoutIssueMessage(state.fieldErrors.street) : undefined}
                size="small"
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label={SITE.checkoutPostalCodeLabelPl}
                  name="postalCode"
                  placeholder="00-001"
                  required
                  defaultValue={v.postalCode}
                  error={state.fieldErrors.postalCode !== undefined}
                  helperText={state.fieldErrors.postalCode !== undefined ? checkoutIssueMessage(state.fieldErrors.postalCode) : undefined}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={SITE.checkoutCityLabelPl}
                  name="city"
                  required
                  defaultValue={v.city}
                  error={state.fieldErrors.city !== undefined}
                  helperText={state.fieldErrors.city !== undefined ? checkoutIssueMessage(state.fieldErrors.city) : undefined}
                  size="small"
                  sx={{ flex: 2 }}
                />
              </Stack>
            </SectionCard>

            <SectionCard heading={SITE.checkoutDeliverySectionHeadingPl}>
              {deliveryMethods.length === 0 ? (
                <Alert severity="warning">{SITE.checkoutNoDeliveryMethodsPl}</Alert>
              ) : (
                <RadioGroup name="deliveryMethodId" value={selectedDeliveryId} onChange={(e) => setSelectedDeliveryId(e.target.value)}>
                  <Stack spacing={1.5}>
                    {deliveryMethods.map((method) => (
                      <Paper
                        key={method.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          opacity: method.feasible ? 1 : 0.6,
                          borderColor: method.id === selectedDeliveryId ? 'secondary.main' : undefined,
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        <FormControlLabel
                          value={method.id}
                          disabled={!method.feasible}
                          control={<Radio size="small" />}
                          sx={{ alignItems: 'flex-start', width: '100%', m: 0 }}
                          label={
                            <Stack sx={{ pt: 0.25 }} spacing={0.5}>
                              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                                <Typography variant="subtitle2">
                                  {method.namePl}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                                  {method.feasible ? formatPln(method.priceGrosze) : '-'}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {method.descPl}
                              </Typography>
                              {method.feasible && method.matchedTierLabelPl !== null && (
                                <Typography variant="caption" color="text.secondary">
                                  {SITE.checkoutDeliveryMatchedTierPl(method.matchedTierLabelPl)}
                                </Typography>
                              )}
                              {method.feasible && method.priceGrosze === 0 && method.matchedTierLabelPl === null && (
                                <Typography variant="caption" color="success.main">
                                  {SITE.checkoutFreeShippingAppliedPl}
                                </Typography>
                              )}
                              {!method.feasible && (
                                <Chip size="small" color="warning" variant="outlined" label={SITE.checkoutDeliveryInfeasibleTagPl} sx={{ alignSelf: 'flex-start' }} />
                              )}
                              {!method.feasible && method.infeasibleReasonPl !== null && (
                                <Typography variant="caption" color="warning.main">
                                  {method.infeasibleReasonPl}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </Paper>
                    ))}
                  </Stack>
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

              {selectedDelivery?.requiresPickupPoint === true && pickupCarrier !== null && (
                <Stack spacing={1} sx={{ pt: 1 }}>
                  <Typography variant="subtitle2">{SITE.checkoutPickupPointLabelPl}</Typography>
                  <input type="hidden" name="pickupPointId" value={selectedPickupPointId ?? ''} />
                  <TextField
                    size="small"
                    placeholder={SITE.checkoutPickupPointSearchPl}
                    value={pickupPointQuery}
                    onChange={(e) => setPickupPointQuery(e.target.value)}
                  />
                  {selectedPickupPoint !== null && (
                    <Alert severity="success" sx={{ py: 0.5 }}>
                      {selectedPickupPoint.label}
                    </Alert>
                  )}
                  <Paper variant="outlined" sx={{ maxHeight: 220, overflowY: 'auto' }}>
                    {pickupPointMatches.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                        {SITE.checkoutPickupPointNoneFoundPl}
                      </Typography>
                    ) : (
                      <List dense disablePadding>
                        {pickupPointMatches.map((point) => (
                          <ListItemButton
                            key={point.id}
                            selected={point.id === selectedPickupPointId}
                            onClick={() => setSelectedPickupPointId(point.id)}
                          >
                            <ListItemText primary={point.label} secondary={point.carrier} />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </Paper>
                  <Typography variant="caption" color="text.secondary">
                    {SITE.checkoutPickupPointSampleNoticePl}
                  </Typography>
                </Stack>
              )}

              <Divider sx={{ my: 1 }} />
              <TextField
                label={SITE.checkoutCourierNoteLabelPl}
                name="courierNotePl"
                defaultValue={v.courierNotePl}
                helperText={SITE.checkoutCourierNoteHelperPl}
                size="small"
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                label={SITE.checkoutInternalNoteLabelPl}
                name="internalShipmentNotePl"
                defaultValue={v.internalShipmentNotePl}
                helperText={SITE.checkoutInternalNoteHelperPl}
                size="small"
                multiline
                minRows={2}
                fullWidth
              />
            </SectionCard>

            <SectionCard heading={SITE.checkoutPaymentSectionHeadingPl}>
              {paymentMethods.length === 0 ? (
                <Alert severity="warning">{SITE.checkoutNoPaymentMethodsPl}</Alert>
              ) : (
                <RadioGroup name="paymentMethodConfigId" defaultValue={defaultPaymentMethodConfigId}>
                  {paymentMethods.map((method) => (
                    <FormControlLabel
                      key={method.id}
                      value={method.id}
                      control={<Radio size="small" />}
                      label={
                        <Stack sx={{ py: 0.25 }}>
                          <Typography variant="body2">{method.namePl}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {method.descPl}
                          </Typography>
                        </Stack>
                      }
                    />
                  ))}
                </RadioGroup>
              )}
              {state.fieldErrors.paymentMethodConfigId !== undefined && (
                <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.paymentMethodConfigId)}</FormHelperText>
              )}
            </SectionCard>

            <Stack spacing={1}>
              <FormControlLabel control={<Checkbox name="termsAccepted" size="small" />} label={SITE.checkoutTermsLabelPl} />
              {state.fieldErrors.terms !== undefined && <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.terms)}</FormHelperText>}

              <FormControlLabel control={<Checkbox name="withdrawalAcknowledged" size="small" />} label={SITE.checkoutWithdrawalExemptionTextPl} />
              {state.fieldErrors.withdrawal !== undefined && <FormHelperText error>{checkoutIssueMessage(state.fieldErrors.withdrawal)}</FormHelperText>}
            </Stack>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 24 } }}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                {SITE.checkoutOrderSummaryHeadingPl}
              </Typography>
              <Stack spacing={1.5} sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
                {cart.items.map((item) => (
                  <Stack key={item.cartItemId} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: 48, height: 48, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: 'action.hover' }}>
                      {item.imageUrl !== null && <Image src={item.imageUrl} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />}
                    </Box>
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {item.productNamePl}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {item.quantity}
                        {item.widthMm !== null && item.heightMm !== null
                          ? ` · ${formatMmAsCentimetres(item.widthMm)}×${formatMmAsCentimetres(item.heightMm)} cm`
                          : ''}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {item.priceGrossGrosze !== null ? formatPln(item.priceGrossGrosze * item.quantity) : '-'}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={0.75}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {SITE.checkoutSubtotalLabelPl} ({itemCount})
                  </Typography>
                  <Typography variant="body2">{formatPln(cart.subtotalGrossGrosze)}</Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {SITE.checkoutShippingLabelPl}
                  </Typography>
                  <Typography variant="body2">{shippingGrosze !== null ? formatPln(shippingGrosze) : '-'}</Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1">{SITE.orderTotalLabelPl}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {totalGrossGrosze !== null ? formatPln(totalGrossGrosze) : '-'}
                  </Typography>
                </Stack>
              </Stack>

              <Box sx={{ mt: 3 }}>
                <SubmitButton
                  disabledReason={
                    selectedDelivery?.requiresPickupPoint === true && selectedPickupPointId === null
                      ? 'pickup'
                      : selectedDelivery === null || !selectedDelivery.feasible
                        ? 'delivery'
                        : null
                  }
                />
              </Box>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
}

function SectionCard({ heading, children }: { readonly heading: string; readonly children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack spacing={2}>
        {/*
         * `h6`, matching the order-summary panel's own heading beside it.
         * These are peer-level section headings on the same screen, and
         * they were rendering as two different things: `subtitle1` with an
         * inline `fontWeight: 600` on the left, `h6` on the right - so the
         * left column's headings were body-face while the right column's
         * were display-face, at a different size and weight. The inline
         * weight override goes with it; `h6` already carries 600 from the
         * theme (2026-08-30 typography pass).
         */}
        <Typography variant="h6" component="h2">
          {heading}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

function SubmitButton({ disabledReason }: { readonly disabledReason: 'pickup' | 'delivery' | null }) {
  const { pending } = useFormStatus();
  return (
    <Stack spacing={1}>
      <Button type="submit" variant="contained" size="large" fullWidth disabled={pending || disabledReason !== null}>
        {SITE.checkoutSubmitPl}
      </Button>
      {disabledReason === 'pickup' && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          {SITE.checkoutPickupPointRequiredHintPl}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * „Uzupełnij moimi danymi", for a signed-in customer.
 *
 * The description is doing real work. There is no address on a `User` - the
 * account holds a name, an email and an optional phone - so the address half
 * comes from this customer's own most recent order, and the copy says so
 * rather than calling it a saved address. Someone who has never ordered is
 * told plainly that the address is not there yet and that we will remember
 * it next time, which is true: their order captures it.
 */
function PrefillPanel({
  prefill,
  applied,
  onApply,
}: {
  readonly prefill: CheckoutPrefill;
  readonly applied: boolean;
  readonly onApply: () => void;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'action.hover' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="text.secondary">
          {prefill.hasPreviousAddress ? SITE.checkoutPrefillWithAddressPl : SITE.checkoutPrefillNoAddressPl}
        </Typography>
        {applied ? (
          <Alert severity="success" sx={{ width: '100%' }}>
            {SITE.checkoutPrefillDonePl}
          </Alert>
        ) : (
          <Button type="button" variant="outlined" size="small" onClick={onApply}>
            {SITE.checkoutPrefillButtonPl}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * The same offer from the other side, for a guest.
 *
 * It offers, and does not gate. Checkout without an account stays a
 * first-class path - the form below works exactly as it always did - because
 * requiring registration to buy something is a real conversion cost and
 * nobody asked for it. `next=` brings them back here rather than dropping
 * them on an account page with a full cart and no way forward.
 */
function GuestAccountPanel() {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'action.hover' }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">{SITE.checkoutGuestHeadingPl}</Typography>
        <Typography variant="body2" color="text.secondary">
          {SITE.checkoutGuestBodyPl}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href="/logowanie?next=/koszyk/zamowienie" variant="outlined" size="small">
            {SITE.checkoutGuestLoginPl}
          </Button>
          <Button component={Link} href="/rejestracja?next=/koszyk/zamowienie" variant="text" size="small">
            {SITE.checkoutGuestRegisterPl}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

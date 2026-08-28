'use server';

/**
 * The checkout form's Server Action — parses and validates real Polish
 * field rules (`domain/checkout/validate.ts`'s NIP checksum, postal code,
 * phone) before ever calling `createOrder`, which re-validates everything
 * about the CART side (prices, feasibility) independently. Two different
 * kinds of validation, two different layers, on purpose: this file owns
 * "is this a well-formed Polish address/NIP", `create-order.ts` owns "is
 * this configuration still real and still this price."
 */

import { redirect } from 'next/navigation';

import { validateNip, validatePhone, validatePostalCode } from '@/domain/checkout/validate';
import { isPlausibleEmail } from '@/domain/text/email';
import type { CheckoutFieldIssueCode } from '@/content/pl/messages';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { createOrder } from '@/server/orders/create-order';

export type CheckoutFormState = {
  readonly fieldErrors: Partial<Record<string, CheckoutFieldIssueCode>>;
  readonly formError: 'CART_EMPTY' | 'PRICE_CHANGED' | 'DELIVERY_METHOD_INVALID' | 'PAYMENT_METHOD_INVALID' | null;
  /**
   * Echoed back so a validation error on one field doesn't erase everything
   * else the customer already typed — `useActionState` re-renders the same
   * form instance rather than remounting it, so uncontrolled inputs
   * otherwise keep whatever the browser happened to have, which after a
   * server round trip is nothing. Consent checkboxes are deliberately NOT
   * echoed — re-confirming those on a corrected resubmission is the right
   * default, not an oversight.
   */
  readonly values: Partial<Record<string, string>>;
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function submitCheckout(
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const email = field(formData, 'email');
  const phone = field(formData, 'phone');
  const firstName = field(formData, 'firstName');
  const lastName = field(formData, 'lastName');
  const companyName = field(formData, 'companyName');
  const nip = field(formData, 'nip');
  const street = field(formData, 'street');
  const postalCode = field(formData, 'postalCode');
  const city = field(formData, 'city');
  const paymentMethodConfigId = field(formData, 'paymentMethodConfigId');
  const deliveryMethodId = field(formData, 'deliveryMethodId');
  const termsAccepted = formData.get('termsAccepted') === 'on';
  const withdrawalAcknowledged = formData.get('withdrawalAcknowledged') === 'on';

  const fieldErrors: Partial<Record<string, CheckoutFieldIssueCode>> = {};
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';
  if (firstName.length === 0) fieldErrors.firstName = 'FIRST_NAME_REQUIRED';
  if (lastName.length === 0) fieldErrors.lastName = 'LAST_NAME_REQUIRED';
  if (phone.length > 0 && !validatePhone(phone)) fieldErrors.phone = 'PHONE_INVALID';
  if (nip.length > 0 && !validateNip(nip)) fieldErrors.nip = 'NIP_INVALID';
  if (street.length === 0) fieldErrors.street = 'STREET_REQUIRED';
  if (!validatePostalCode(postalCode)) fieldErrors.postalCode = 'POSTAL_CODE_INVALID';
  if (city.length === 0) fieldErrors.city = 'CITY_REQUIRED';
  if (paymentMethodConfigId.length === 0) fieldErrors.paymentMethodConfigId = 'PAYMENT_METHOD_REQUIRED';
  if (deliveryMethodId.length === 0) fieldErrors.deliveryMethodId = 'DELIVERY_METHOD_REQUIRED';
  if (!termsAccepted) fieldErrors.terms = 'TERMS_NOT_ACCEPTED';
  if (!withdrawalAcknowledged) fieldErrors.withdrawal = 'WITHDRAWAL_NOT_ACKNOWLEDGED';

  const values = {
    email,
    phone,
    firstName,
    lastName,
    companyName,
    nip,
    street,
    postalCode,
    city,
    paymentMethodConfigId,
    deliveryMethodId,
  };

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values };
  }

  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  const result = await createOrder({
    sessionToken,
    userId: session?.userId ?? null,
    email,
    phone: phone.length > 0 ? phone : null,
    firstName,
    lastName,
    companyName: companyName.length > 0 ? companyName : null,
    nip: nip.length > 0 ? nip : null,
    street,
    postalCode,
    city,
    paymentMethodConfigId,
    deliveryMethodId,
  });

  if (!result.ok) {
    return { fieldErrors: {}, formError: result.code, values };
  }

  // `orderNumber` ("2026/08/0042") contains real slashes — encoded here so
  // it lands as ONE path segment; Next.js decodes `params.orderNumber`
  // back to the real value automatically on the receiving page.
  redirect(
    `/zamowienie/${encodeURIComponent(result.orderNumber)}?token=${encodeURIComponent(result.accessToken)}`,
  );
}

/**
 * The guest lookup form's action — a zero-client-JS `<form action>` that
 * just redirects to the real confirmation URL. That page does the actual
 * lookup and constant-time token check; a wrong pair simply renders its
 * honest "not found" state, same as this being submitted with nonsense.
 */
export async function lookupOrder(formData: FormData): Promise<void> {
  const orderNumber = field(formData, 'orderNumber');
  const token = field(formData, 'token');
  redirect(`/zamowienie/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`);
}

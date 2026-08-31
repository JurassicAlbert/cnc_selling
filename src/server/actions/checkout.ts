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

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { validateNip, validatePhone, validatePostalCode } from '@/domain/checkout/validate';
import { isPlausibleEmail } from '@/domain/text/email';
import type { CheckoutFieldIssueCode } from '@/content/pl/messages';
import { getSession } from '@/server/auth/session';
import { consumeOrderAttempt } from '@/server/rate-limit/auth-throttle';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { requestIpAddress } from '@/server/session/request-ip';
import { createOrder } from '@/server/orders/create-order';

export type CheckoutFormState = {
  readonly fieldErrors: Partial<Record<string, CheckoutFieldIssueCode>>;
  readonly formError:
    | 'CART_EMPTY'
    | 'CART_CHANGED'
    | 'PRICE_CHANGED'
    | 'DELIVERY_METHOD_INVALID'
    | 'PAYMENT_METHOD_INVALID'
    | 'PICKUP_POINT_INVALID'
    /** §16.1's per-IP order-creation limit refused this submission (`docs/AUDIT-2026-08-30.md` P1-8). */
    | 'RATE_LIMITED'
    /** A pattern, material or finish in the cart is no longer offered (`docs/REVIEW-DETAILED.md` SEC-03). */
    | 'OPTION_UNAVAILABLE'
    | null;
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
  // Minted server-side when the checkout page rendered and carried in a
  // hidden field, so every resubmission of THIS form arrives with the same
  // value — see `create-order.ts`'s header (`docs/AUDIT-2026-08-30.md`
  // P0-2). Never generated here: a fresh one per invocation would make
  // every duplicate submission look like a brand-new purchase, which is
  // precisely the bug.
  const idempotencyKey = field(formData, 'idempotencyKey');
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
  const pickupPointIdRaw = field(formData, 'pickupPointId');
  const pickupPointId = pickupPointIdRaw.length > 0 ? pickupPointIdRaw : null;
  const courierNoteRaw = field(formData, 'courierNotePl');
  const courierNotePl = courierNoteRaw.length > 0 ? courierNoteRaw : null;
  const internalShipmentNoteRaw = field(formData, 'internalShipmentNotePl');
  const internalShipmentNotePl = internalShipmentNoteRaw.length > 0 ? internalShipmentNoteRaw : null;
  const termsAccepted = formData.get('termsAccepted') === 'on';
  const withdrawalAcknowledged = formData.get('withdrawalAcknowledged') === 'on';

  const fieldErrors: Partial<Record<string, CheckoutFieldIssueCode>> = {};
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';
  if (firstName.length === 0) fieldErrors.firstName = 'FIRST_NAME_REQUIRED';
  if (lastName.length === 0) fieldErrors.lastName = 'LAST_NAME_REQUIRED';
  // 2026-08-29, owner request: required, not optional — a status/shipment
  // update needs a real contact channel beyond email.
  if (phone.length === 0) fieldErrors.phone = 'PHONE_REQUIRED';
  else if (!validatePhone(phone)) fieldErrors.phone = 'PHONE_INVALID';
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
    pickupPointId: pickupPointId ?? '',
    courierNotePl: courierNotePl ?? '',
    internalShipmentNotePl: internalShipmentNotePl ?? '',
  };

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values };
  }

  // §16.1's "order creation per IP" (`docs/AUDIT-2026-08-30.md` P1-8, open
  // until `docs/OPEN_ITEMS.md` §6's storage question was answered). Checked
  // AFTER field validation, so a customer correcting a typo never burns an
  // attempt, and deliberately generous — this guards against a script, not
  // against someone ordering twice in an evening. Duplicate SUBMISSIONS are
  // a different problem, already solved by `Order.idempotencyKey` and cart
  // claiming; this is about volume.
  const [sessionToken, session, ip] = await Promise.all([
    readGuestSessionToken(),
    getSession(),
    requestIpAddress(),
  ]);
  const throttle = await consumeOrderAttempt({ ip });
  if (!throttle.allowed) {
    return { fieldErrors: {}, formError: 'RATE_LIMITED', values };
  }

  const result = await createOrder({
    // A form submitted without one (only reachable by bypassing the real
    // page) still gets a real, unguessable key — it simply gets no
    // deduplication across requests, which is strictly no worse than the
    // behaviour before this existed, and never blocks a genuine order.
    idempotencyKey: idempotencyKey.length > 0 ? idempotencyKey : randomUUID(),
    sessionToken,
    userId: session?.userId ?? null,
    email,
    phone,
    firstName,
    lastName,
    companyName: companyName.length > 0 ? companyName : null,
    nip: nip.length > 0 ? nip : null,
    street,
    postalCode,
    city,
    paymentMethodConfigId,
    deliveryMethodId,
    pickupPointId,
    courierNotePl,
    internalShipmentNotePl,
  });

  if (!result.ok) {
    return { fieldErrors: {}, formError: result.code, values };
  }

  // 2026-08-29, owner feedback: "koszyk nie restuje się od razu po
  // skończeniu zamówienia" — a real bug, not a display choice. The cart
  // rows are gone by now, but Next.js's client Router Cache can keep
  // serving the PREVIOUS cached render of the layout that draws
  // `SiteHeader`'s cart badge for up to 30s after a soft navigation, since
  // nothing has told it that layout's data changed. Invalidating at layout
  // scope makes the very next request — including the redirect below —
  // pick up the now-empty cart immediately, not eventually.
  //
  // Lives here rather than in `createOrder` because only this layer is
  // guaranteed to run inside a request scope (2026-08-30).
  revalidatePath('/', 'layout');

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

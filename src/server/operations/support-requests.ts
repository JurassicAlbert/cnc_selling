/**
 * Real, internal DB-driven support/contact submission — no fake external
 * communication integration (§9/§15): this creates a row a staff member
 * reads and answers through the panel, nothing more. `email` is always
 * captured directly (even for a logged-in user), same "capture, don't
 * re-read from the profile" discipline as `Order`'s own buyer fields.
 *
 * Order/shipment context is re-verified here, never trusted from a hidden
 * form field alone — same ownership discipline as `reviews.ts`'s guest
 * (accessToken, constant-time compare) / logged-in (`getSession()`) split.
 * A request whose context fails to verify is still submitted — just
 * without the link — rather than the whole submission being rejected:
 * getting the message to staff matters more than the optional context.
 *
 * Same `applyXxx(sessionUserId, ...)` / `xxx(...)` split as every other
 * `cookies()`/`headers()`-dependent action in this codebase: `getSession()`
 * throws outside real Next.js request scope, so the pure half takes the
 * caller's id explicitly (directly testable), and the wrapper derives it
 * from the real request.
 */

import { timingSafeEqual } from 'node:crypto';

import { isPlausibleEmail } from '@/domain/text/email';
import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';

export type SubmitSupportRequestResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

type SupportRequestFields = {
  readonly email: string;
  readonly namePl: string | null;
  readonly subjectPl: string;
  readonly messagePl: string;
};

function readFields(formData: FormData): SupportRequestFields {
  const nameRaw = String(formData.get('namePl') ?? '').trim();
  return {
    email: String(formData.get('email') ?? '').trim(),
    namePl: nameRaw.length > 0 ? nameRaw : null,
    subjectPl: String(formData.get('subjectPl') ?? '').trim(),
    messagePl: String(formData.get('messagePl') ?? '').trim(),
  };
}

function validateFields(fields: SupportRequestFields): string | null {
  if (fields.email.length === 0 || !isPlausibleEmail(fields.email)) {
    return 'Podaj poprawny adres e-mail.';
  }
  if (fields.subjectPl.length === 0) {
    return 'Podaj temat zgłoszenia.';
  }
  if (fields.messagePl.length === 0) {
    return 'Podaj treść wiadomości.';
  }
  return null;
}

/** Resolves a real, verified `Order`+`Shipment` id pair for the optional context — never trusts `orderNumber`/`token` alone without checking them against the real row. */
async function resolveVerifiedOrderContext(
  orderNumber: string | null,
  token: string | null,
  sessionUserId: string | null,
): Promise<{ readonly orderId: string | null; readonly shipmentId: string | null }> {
  if (orderNumber === null) {
    return { orderId: null, shipmentId: null };
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, userId: true, accessToken: true, shipment: { select: { id: true } } },
  });
  if (order === null) {
    return { orderId: null, shipmentId: null };
  }
  const ownedBySession = sessionUserId !== null && order.userId === sessionUserId;
  const ownedByToken =
    token !== null &&
    Buffer.from(token).length === Buffer.from(order.accessToken).length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken));
  if (!ownedBySession && !ownedByToken) {
    return { orderId: null, shipmentId: null };
  }
  return { orderId: order.id, shipmentId: order.shipment?.id ?? null };
}

async function createSupportRequest(
  fields: SupportRequestFields,
  context: { readonly userId: string | null; readonly orderId: string | null; readonly shipmentId: string | null },
): Promise<SubmitSupportRequestResult> {
  await prisma.supportRequest.create({
    data: {
      userId: context.userId,
      orderId: context.orderId,
      shipmentId: context.shipmentId,
      email: fields.email,
      namePl: fields.namePl,
      subjectPl: fields.subjectPl,
      messagePl: fields.messagePl,
    },
  });
  return { ok: true };
}

/** Standalone `/kontakt` form — no order context. Pure/testable half. */
export async function applySubmitSupportRequest(sessionUserId: string | null, formData: FormData): Promise<SubmitSupportRequestResult> {
  const fields = readFields(formData);
  const issue = validateFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  return createSupportRequest(fields, { userId: sessionUserId, orderId: null, shipmentId: null });
}

/** The real Server Action — derives the session from the actual request. */
export async function submitSupportRequest(formData: FormData): Promise<SubmitSupportRequestResult> {
  const session = await getSession();
  return applySubmitSupportRequest(session?.userId ?? null, formData);
}

/** Contextual form embedded on an order/shipment page — `orderNumber` always given; `token` only for the guest confirmation page (null when the logged-in account page renders this, since session ownership covers it instead). Pure/testable half. */
export async function applySubmitOrderSupportRequest(
  sessionUserId: string | null,
  orderNumber: string,
  token: string | null,
  formData: FormData,
): Promise<SubmitSupportRequestResult> {
  const fields = readFields(formData);
  const issue = validateFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const context = await resolveVerifiedOrderContext(orderNumber, token, sessionUserId);
  return createSupportRequest(fields, { userId: sessionUserId, orderId: context.orderId, shipmentId: context.shipmentId });
}

/** The real Server Action — derives the session from the actual request. */
export async function submitOrderSupportRequest(orderNumber: string, token: string | null, formData: FormData): Promise<SubmitSupportRequestResult> {
  const session = await getSession();
  return applySubmitOrderSupportRequest(session?.userId ?? null, orderNumber, token, formData);
}

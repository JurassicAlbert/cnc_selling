/**
 * Real, internal DB-driven support/contact submission - no fake external
 * communication integration (§9/§15): this creates a row a staff member
 * reads and answers through the panel, nothing more. `email` is always
 * captured directly (even for a logged-in user), same "capture, don't
 * re-read from the profile" discipline as `Order`'s own buyer fields.
 *
 * Order/shipment context is re-verified here, never trusted from a hidden
 * form field alone - same ownership discipline as `reviews.ts`'s guest
 * (accessToken, constant-time compare) / logged-in (`getSession()`) split.
 * A request whose context fails to verify is still submitted - just
 * without the link - rather than the whole submission being rejected:
 * getting the message to staff matters more than the optional context.
 *
 * Same `applyXxx(sessionUserId, ...)` / `xxx(...)` split as every other
 * `cookies()`/`headers()`-dependent action in this codebase: `getSession()`
 * throws outside real Next.js request scope, so the pure half takes the
 * caller's id explicitly (directly testable), and the wrapper derives it
 * from the real request.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

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

/** Resolves a real, verified `Order`+`Shipment` id pair for the optional context - never trusts `orderNumber`/`token` alone without checking them against the real row. */
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

/**
 * How long an identical message counts as the same submission rather than a
 * genuinely new one (2026-08-30 duplicate sweep).
 *
 * The support form is a zero-JS `<form action>`, so nothing on the client
 * disables it while the action runs: a double-click, an impatient second
 * click, or a browser retry after a dropped connection each filed a second
 * identical request, and staff saw the same question twice with no way to
 * tell whether the customer had really asked twice.
 *
 * A window rather than a unique constraint, because a customer writing in
 * again a week later with the same subject and message IS a real second
 * request - usually because nobody answered the first one, which is exactly
 * when they must not be silently swallowed.
 */
const DUPLICATE_SUPPORT_REQUEST_WINDOW_MS = 5 * 60 * 1000;

/**
 * NUL, written as an escape rather than as a literal byte.
 *
 * It cannot occur in any of the hashed fields (Postgres rejects NUL in a
 * `text` column), so no value can impersonate a field boundary and make two
 * different submissions hash alike. Written as `\u0000` deliberately: a
 * literal NUL in source is invisible in review, turns the file binary to
 * every diff tool, and has already bitten this codebase once - the first
 * cart-signature encoding used one and Postgres refused to store it.
 */
const SEPARATOR = '\u0000';

async function createSupportRequest(
  fields: SupportRequestFields,
  context: { readonly userId: string | null; readonly orderId: string | null; readonly shipmentId: string | null },
): Promise<SubmitSupportRequestResult> {
  // Two guards, because they catch different things and neither is enough
  // alone. The window query catches a resubmission that straddles a bucket
  // boundary; the `@unique` dedupe key is what makes two GENUINELY
  // concurrent submissions impossible, which a read-then-write check cannot
  // do (both reads see nothing, both insert). Same pairing, and the same
  // reasoning, as `createOrder`'s idempotency key.
  const duplicate = await prisma.supportRequest.findFirst({
    where: {
      email: fields.email,
      subjectPl: fields.subjectPl,
      messagePl: fields.messagePl,
      orderId: context.orderId,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_SUPPORT_REQUEST_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (duplicate !== null) {
    // Reported as success on purpose: from the customer's side the message
    // HAS been sent, and telling them it failed would only make them send
    // it a third time.
    return { ok: true };
  }

  try {
    await prisma.supportRequest.create({
      data: {
        dedupeKey: supportRequestDedupeKey(fields, context.orderId),
        userId: context.userId,
        orderId: context.orderId,
        shipmentId: context.shipmentId,
        email: fields.email,
        namePl: fields.namePl,
        subjectPl: fields.subjectPl,
        messagePl: fields.messagePl,
      },
    });
  } catch (error) {
    // The other half of a genuinely concurrent double-submit lost the race
    // on the unique index. Its message is already filed, so this is a
    // success from the customer's side, not a failure to retry.
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
  }
  return { ok: true };
}

/** Duck-typed rather than instance-checked, so it never depends on which generated client threw. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

/**
 * Identity of one submission: the message itself, the order it is about,
 * and which five-minute bucket it landed in.
 *
 * The bucket is deliberately coarse and deliberately not a rolling window -
 * a unique index can only compare equal values, not ranges. Two clicks
 * either side of a bucket boundary are caught by the time-window query
 * above instead; between them the realistic cases are covered.
 *
 * Hashed rather than concatenated so an arbitrarily long message still
 * yields a short, indexable key.
 */
function supportRequestDedupeKey(fields: SupportRequestFields, orderId: string | null): string {
  const bucket = Math.floor(Date.now() / DUPLICATE_SUPPORT_REQUEST_WINDOW_MS);
  const parts = [fields.email, fields.subjectPl, fields.messagePl, orderId ?? '', String(bucket)];
  // `SEPARATOR` is what stops a value impersonating a field boundary.
  return createHash('sha256').update(parts.join(SEPARATOR)).digest('hex');
}

/** Standalone `/kontakt` form - no order context. Pure/testable half. */
export async function applySubmitSupportRequest(sessionUserId: string | null, formData: FormData): Promise<SubmitSupportRequestResult> {
  const fields = readFields(formData);
  const issue = validateFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  return createSupportRequest(fields, { userId: sessionUserId, orderId: null, shipmentId: null });
}

/** The real Server Action - derives the session from the actual request. */
export async function submitSupportRequest(formData: FormData): Promise<SubmitSupportRequestResult> {
  const session = await getSession();
  return applySubmitSupportRequest(session?.userId ?? null, formData);
}

/** Contextual form embedded on an order/shipment page - `orderNumber` always given; `token` only for the guest confirmation page (null when the logged-in account page renders this, since session ownership covers it instead). Pure/testable half. */
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

/** The real Server Action - derives the session from the actual request. */
export async function submitOrderSupportRequest(orderNumber: string, token: string | null, formData: FormData): Promise<SubmitSupportRequestResult> {
  const session = await getSession();
  return applySubmitOrderSupportRequest(session?.userId ?? null, orderNumber, token, formData);
}

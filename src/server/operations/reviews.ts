/**
 * Real customer review submission. Two entry points — guest (order
 * `accessToken`, same constant-time comparison `repositories/orders.ts`'s
 * `findOrderForConfirmation` already uses) and logged-in (`getSession()`)
 * — both re-verify ownership AND `status === 'COMPLETED'` AND that no
 * review exists yet server-side, never trusting the page that rendered
 * the form. No update-content action exists anywhere in this codebase —
 * once submitted, a review's text/author/rating can never be changed by
 * anyone, staff included (§16A.1 module 9: "no facility to author a
 * testimonial in a customer's name"). Moderation (`admin-reviews.ts`)
 * only ever changes `status`.
 */

import { timingSafeEqual } from 'node:crypto';

import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';

export type SubmitReviewResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function readReviewFields(formData: FormData): { readonly authorNamePl: string; readonly rating: number; readonly bodyPl: string } {
  return {
    authorNamePl: String(formData.get('authorNamePl') ?? '').trim(),
    rating: Number(formData.get('rating') ?? 0),
    bodyPl: String(formData.get('bodyPl') ?? '').trim(),
  };
}

function validateReviewFields(fields: { readonly authorNamePl: string; readonly rating: number; readonly bodyPl: string }): string | null {
  if (fields.authorNamePl.length === 0) {
    return 'Imię jest wymagane.';
  }
  if (!Number.isInteger(fields.rating) || fields.rating < 1 || fields.rating > 5) {
    return `Ocena musi być liczbą całkowitą od 1 do 5 — podano ${Number.isFinite(fields.rating) ? fields.rating : 'nieprawidłową wartość'}.`;
  }
  if (fields.bodyPl.length === 0) {
    return 'Treść opinii jest wymagana.';
  }
  return null;
}

async function createReviewForOrder(
  orderId: string,
  fields: { readonly authorNamePl: string; readonly rating: number; readonly bodyPl: string },
): Promise<SubmitReviewResult> {
  const existing = await prisma.review.findUnique({ where: { orderId }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Opinia dla tego zamówienia została już przesłana.' };
  }
  await prisma.review.create({ data: { orderId, ...fields } });
  return { ok: true };
}

/** Guest submission — `orderNumber` + the same `accessToken` the confirmation page itself requires. */
export async function submitGuestReview(orderNumber: string, token: string, formData: FormData): Promise<SubmitReviewResult> {
  const fields = readReviewFields(formData);
  const issue = validateReviewFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, accessToken: true, status: true },
  });
  if (order === null) {
    return { ok: false, detail: 'Nie znaleziono zamówienia.' };
  }
  const provided = Buffer.from(token);
  const expected = Buffer.from(order.accessToken);
  const matches = provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!matches) {
    return { ok: false, detail: 'Nie znaleziono zamówienia.' };
  }
  if (order.status !== 'COMPLETED') {
    return { ok: false, detail: 'Opinię można dodać dopiero po zrealizowaniu zamówienia.' };
  }

  return createReviewForOrder(order.id, fields);
}

/**
 * Logged-in submission — ownership via the real session, not a
 * client-supplied id. Split like every other `require*`-style helper in
 * this codebase (`design-review.ts`'s own header explains why):
 * `applySubmitAccountReview` takes `userId` explicitly (real DB logic,
 * directly callable from an integration test), `submitAccountReview` — the
 * actual Server Action — derives it via `getSession()`, which reads
 * `next/headers` and only works inside a real request.
 */
export async function applySubmitAccountReview(userId: string, orderNumber: string, formData: FormData): Promise<SubmitReviewResult> {
  const fields = readReviewFields(formData);
  const issue = validateReviewFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, userId: true, status: true },
  });
  if (order === null || order.userId !== userId) {
    return { ok: false, detail: 'Nie znaleziono zamówienia.' };
  }
  if (order.status !== 'COMPLETED') {
    return { ok: false, detail: 'Opinię można dodać dopiero po zrealizowaniu zamówienia.' };
  }

  return createReviewForOrder(order.id, fields);
}

export async function submitAccountReview(orderNumber: string, formData: FormData): Promise<SubmitReviewResult> {
  const session = await getSession();
  if (session === null) {
    return { ok: false, detail: 'Zaloguj się, aby dodać opinię.' };
  }
  return applySubmitAccountReview(session.userId, orderNumber, formData);
}

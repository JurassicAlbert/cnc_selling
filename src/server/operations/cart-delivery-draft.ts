/**
 * Saving the delivery details a customer typed on the cart page - owner
 * request, 2026-09-04: the cart should let someone give their full address
 * and a note there, the way the reference layout's cart does.
 *
 * Its own module rather than an addition to `operations/cart.ts`, which is
 * already the largest operations file and is entirely about what is *in* the
 * cart rather than where it is going.
 *
 * The same `applyXxx(actor, …)` / `xxx(…)` split as every other mutation
 * here: the `apply` half takes the caller's identity as an argument, so an
 * integration test can reach it, and the thin half derives that identity
 * from the request. See `docs/AUDIT-2026-08-30.md` P0-1.
 *
 * **Deliberately unvalidated.** This is a draft that is saved while somebody
 * is still typing, so refusing a half-finished postcode would make the form
 * unusable and refusing a malformed email would refuse it on the first
 * keystroke. The binding validation is `createOrder`'s, unchanged, and it
 * runs on what is actually submitted at checkout - never on this. Nothing
 * here can produce an order, a price, or a shipment.
 *
 * What it does enforce is length. These columns are free text that a
 * customer can write into, and an unbounded write is a way to fill a table
 * with one request.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';

export type CartDeliveryDraftInput = {
  readonly email: string;
  readonly phone: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly courierNotePl: string;
};

export type CartOwner = {
  readonly userId: string | null;
  readonly sessionToken: string | null;
};

export type SaveCartDeliveryDraftResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'NO_CART' | 'TOO_LONG' };

/** Generous for a real address line, short enough that nobody stores a novel. */
const MAX_FIELD_LENGTH = 200;
/** The courier note is a sentence or two: a gate code, a floor, a neighbour. */
const MAX_NOTE_LENGTH = 1_000;

function blankToNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function tooLong(input: CartDeliveryDraftInput): boolean {
  const fields = [input.email, input.phone, input.firstName, input.lastName, input.street, input.postalCode, input.city];
  return (
    fields.some((value) => typeof value === 'string' && value.length > MAX_FIELD_LENGTH) ||
    (typeof input.courierNotePl === 'string' && input.courierNotePl.length > MAX_NOTE_LENGTH)
  );
}

export async function applySaveCartDeliveryDraft(
  owner: CartOwner,
  input: CartDeliveryDraftInput,
): Promise<SaveCartDeliveryDraftResult> {
  if (owner.userId === null && owner.sessionToken === null) {
    return { ok: false, code: 'NO_CART' };
  }
  if (tooLong(input)) {
    return { ok: false, code: 'TOO_LONG' };
  }

  // `updateMany`, not `update`: there may be no cart yet, and this must never
  // be the thing that mints one. A cart minted from a page that has not added
  // an item to it is a row nobody asked for, and the cart page reaches this
  // only when there is already something in it.
  const updated = await prisma.cart.updateMany({
    where: owner.userId !== null ? { userId: owner.userId } : { sessionToken: owner.sessionToken },
    data: {
      draftEmail: blankToNull(input.email),
      draftPhone: blankToNull(input.phone),
      draftFirstName: blankToNull(input.firstName),
      draftLastName: blankToNull(input.lastName),
      draftStreet: blankToNull(input.street),
      draftPostalCode: blankToNull(input.postalCode),
      draftCity: blankToNull(input.city),
      draftCourierNotePl: blankToNull(input.courierNotePl),
    },
  });

  if (updated.count === 0) {
    return { ok: false, code: 'NO_CART' };
  }
  return { ok: true };
}

export async function saveCartDeliveryDraft(
  input: CartDeliveryDraftInput,
): Promise<SaveCartDeliveryDraftResult> {
  const [session, sessionToken] = await Promise.all([getSession(), readGuestSessionToken()]);
  const result = await applySaveCartDeliveryDraft(
    { userId: session?.userId ?? null, sessionToken },
    input,
  );
  if (result.ok) {
    revalidatePath('/koszyk');
    // The checkout form pre-fills from this, so it has to see the new values
    // on the very next navigation - which is the whole point of saving here.
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

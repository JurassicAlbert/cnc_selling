import { prisma } from '@/server/db/client';

/**
 * The buyer details we can honestly offer to fill the order form with, for a
 * signed-in customer - owner request, 2026-09-04: "formularz danych powinien
 * mieć opcje wczytania danych z profilu jeśli jesteśmy zalogowani".
 *
 * **Where each field really comes from, because there is no profile address.**
 * `User` holds a name, an email and an optional phone, and nothing else - no
 * street, no city, no company. So the address half is read from the
 * customer's most recent order, which is real data they entered themselves
 * and the only address this shop has ever been given by them.
 *
 * That distinction is not cosmetic and the UI says it out loud: offering
 * „your saved address" when what is actually being offered is „the address
 * you used last time" would be describing a feature the shop does not have.
 * If they have never ordered, the address fields simply are not offered, and
 * the name and email still are.
 *
 * Anonymised accounts are excluded. RODO deletion overwrites the name and
 * email in place and keeps the order rows for accounting; re-offering that
 * scrubbed data as a convenience would quietly undo the erasure.
 */
export type CheckoutPrefill = {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly companyName: string;
  readonly nip: string;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  /** Whether any of the address half came back, so the UI can say what it is offering. */
  readonly hasPreviousAddress: boolean;
};

/**
 * A `User.name` is one field. Splitting on the last space is a guess, and a
 * safe one here: the customer sees both boxes filled and can correct either
 * before submitting. Nothing is stored from this - `createOrder` captures
 * whatever the form actually contained.
 */
function splitName(fullName: string): { readonly firstName: string; readonly lastName: string } {
  const trimmed = fullName.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return { firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1) };
}

export async function getCheckoutPrefill(userId: string): Promise<CheckoutPrefill | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, anonymizedAt: true },
  });

  if (user === null || user.anonymizedAt !== null) {
    return null;
  }

  // The most recent order this customer placed, for the address half. Their
  // own captured data, not a profile field that does not exist.
  const lastOrder = await prisma.order.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      phone: true,
      companyName: true,
      nip: true,
      street: true,
      postalCode: true,
      city: true,
    },
  });

  const { firstName, lastName } = splitName(user.name);

  return {
    firstName,
    lastName,
    email: user.email,
    // The account's phone if it has one, otherwise the number they gave with
    // their last order - `User.phone` is optional and often empty.
    phone: user.phone ?? lastOrder?.phone ?? '',
    companyName: lastOrder?.companyName ?? '',
    nip: lastOrder?.nip ?? '',
    street: lastOrder?.street ?? '',
    postalCode: lastOrder?.postalCode ?? '',
    city: lastOrder?.city ?? '',
    hasPreviousAddress: lastOrder !== null,
  };
}

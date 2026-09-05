/**
 * „Uzupełnij moimi danymi" on the order form - owner request, 2026-09-04.
 *
 * What is worth pinning here is where the data honestly comes from. `User`
 * holds a name, an email and an optional phone, and no address at all, so
 * the address half can only come from the customer's own most recent order.
 * A convenience that quietly invents an address, or that offers one the
 * customer never gave this shop, would be worse than no convenience.
 *
 * The two cases that matter are a customer who has ordered before and one
 * who has not, because the second is every new customer and is exactly where
 * a naive implementation starts filling boxes with empty strings and calling
 * it a saved address.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { getCheckoutPrefill } from '@/server/repositories/checkout-prefill';

const PREFIX = 'test-checkout-prefill-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

async function makeUser(overrides: { readonly name?: string; readonly phone?: string | null } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? 'Ala Kowalska',
      email: `${uid()}@example.test`,
      phone: overrides.phone === undefined ? '600100200' : overrides.phone,
    },
  });
}

async function makeOrderFor(userId: string, overrides: Record<string, string> = {}) {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      userId,
      paymentMethod: 'BANK_TRANSFER',
      email: 'zamowienie@example.test',
      phone: overrides.phone ?? '500600700',
      firstName: 'Ala',
      lastName: 'Kowalska',
      companyName: overrides.companyName ?? null,
      nip: overrides.nip ?? null,
      street: overrides.street ?? 'Kwiatowa 5/2',
      postalCode: overrides.postalCode ?? '30-001',
      city: overrides.city ?? 'Kraków',
      subtotalNetGrosze: 10_000,
      vatGrosze: 2_300,
      shippingGrosze: 0,
      totalGrossGrosze: 12_300,
      deliveryMethodNamePl: 'Kurier',
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'test',
      withdrawalAcknowledgedAt: new Date(),
    },
  });
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('getCheckoutPrefill', () => {
  it('offers the account name and email, and says there is no address yet', async () => {
    const user = await makeUser();

    const prefill = await getCheckoutPrefill(user.id);

    expect(prefill?.firstName).toBe('Ala');
    expect(prefill?.lastName).toBe('Kowalska');
    expect(prefill?.email).toBe(user.email);
    expect(prefill?.phone).toBe('600100200');
    // The flag the UI needs in order to describe what it is offering. A new
    // customer has given this shop no address, and the form must not pretend
    // otherwise by filling three boxes with empty strings.
    expect(prefill?.hasPreviousAddress).toBe(false);
    expect(prefill?.street).toBe('');
    expect(prefill?.city).toBe('');
  });

  it('takes the address from the most recent order, not from a profile field that does not exist', async () => {
    const user = await makeUser();
    await makeOrderFor(user.id, { street: 'Stara 1', city: 'Gdańsk', postalCode: '80-001' });
    // Deliberately created second, so "most recent" is doing real work rather
    // than "the only one".
    await makeOrderFor(user.id, { street: 'Nowa 9', city: 'Kraków', postalCode: '30-002' });

    const prefill = await getCheckoutPrefill(user.id);

    expect(prefill?.hasPreviousAddress).toBe(true);
    expect(prefill?.street).toBe('Nowa 9');
    expect(prefill?.city).toBe('Kraków');
    expect(prefill?.postalCode).toBe('30-002');
  });

  it('falls back to the order phone when the account has none', async () => {
    const user = await makeUser({ phone: null });
    await makeOrderFor(user.id, { phone: '111222333' });

    expect((await getCheckoutPrefill(user.id))?.phone).toBe('111222333');
  });

  it('splits a one-field name on the last space', async () => {
    const user = await makeUser({ name: 'Anna Maria Nowak-Kowalska' });

    const prefill = await getCheckoutPrefill(user.id);

    // A guess, and a safe one: both boxes are shown filled and either can be
    // corrected before submitting. Nothing is stored from it.
    expect(prefill?.firstName).toBe('Anna Maria');
    expect(prefill?.lastName).toBe('Nowak-Kowalska');
  });

  it('offers nothing at all for an anonymised account', async () => {
    // RODO deletion overwrites the name and email in place and keeps the
    // order rows for accounting. Re-offering that scrubbed data as a
    // convenience would quietly undo the erasure.
    const user = await makeUser();
    await prisma.user.update({ where: { id: user.id }, data: { anonymizedAt: new Date() } });

    expect(await getCheckoutPrefill(user.id)).toBeNull();
  });

  it('offers nothing for a user that does not exist', async () => {
    expect(await getCheckoutPrefill('no-such-user')).toBeNull();
  });
});
